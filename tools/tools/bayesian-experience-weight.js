function clean(value, limit = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function routeKey(experience = {}) {
  return [
    clean(experience.agentId || "unknown", 80),
    clean(experience.appId || "unknown", 100),
    clean(experience.action || "use", 50)
  ].join("|");
}

function probability(alpha, beta) {
  return Number((alpha / (alpha + beta)).toFixed(4));
}

function retentionCost(experience = {}) {
  const appId = clean(experience.appId, 100).toLowerCase();
  if (/browser|vision|game/.test(appId)) return 0.35;
  if (/media|map|weather/.test(appId)) return 0.18;
  return 0.12;
}

function noveltyFor(route) {
  // A route is most exploratory while evidence is scarce; this decays without
  // deleting the route or treating unfamiliarity as a failure.
  return Number((1 / Math.sqrt(Math.max(1, route.attempts || 1))).toFixed(4));
}

function retentionTier(route) {
  const score = route.candidate?.retentionScore ?? 0;
  if (route.attempts >= 5 && score >= 0.72) return "core-reference";
  if (score >= 0.48) return "active-exploration";
  if (score >= 0.18) return "cold-storage";
  return "low-priority-retain";
}

function updateCandidate(route, experience = {}) {
  const novelty = noveltyFor(route);
  const cost = retentionCost(experience);
  const explorationWeight = 0.2;
  const retentionScore = Number((route.posterior.successProbability + explorationWeight * novelty - cost).toFixed(4));
  route.candidate = {
    hypothesis: "This variation may become useful when later interaction supplies supporting evidence.",
    expectedValue: route.posterior.successProbability,
    novelty,
    retentionCost: cost,
    explorationWeight,
    retentionScore,
    tier: "pending"
  };
  route.candidate.tier = retentionTier(route);
}

function nextHintFor(route) {
  if (route.attempts < 2) return "Evidence is still thin; observe the result before treating this as a preferred route.";
  if (route.posterior.successProbability >= 0.7) return "This route is usually reliable; it is a good first option when it fits the current page.";
  if (route.posterior.successProbability <= 0.4) return "This route often fails; inspect the live page and prefer a different repair action when possible.";
  return "This route is mixed; use current visual evidence to decide whether to try it or choose another path.";
}

export function createBayesianExperienceState(createdAt = new Date().toISOString()) {
  return {
    schema: "bayesian-experience-weight-state-v0",
    createdAt,
    updatedAt: createdAt,
    enabled: true,
    mode: "inspectable-shadow-only",
    policy: {
      prior: "beta(1,1)",
      candidateModel: "BIU v1: posterior value + exploration-weighted novelty - estimated retention cost",
      changesLiveRouting: false,
      mutatesThoughtUnits: false,
      deletesExperiences: false,
      reversibleByRebuild: true
    },
    totalEvidence: 0,
    routes: {},
    recentUpdates: []
  };
}

export function applyBayesianExperience(stateInput, experience = {}) {
  const now = experience.createdAt || new Date().toISOString();
  const state = stateInput && typeof stateInput === "object"
    ? structuredClone(stateInput)
    : createBayesianExperienceState(now);
  state.routes ||= {};
  state.recentUpdates ||= [];

  const key = routeKey(experience);
  const succeeded = experience.succeeded !== false;
  const route = state.routes[key] || {
    key,
    context: {
      agentId: experience.agentId || "unknown",
      appId: experience.appId || "unknown",
      action: experience.action || "use",
      route: experience.route || "unknown"
    },
    hypothesis: "This route will complete the requested local action when its current UI preconditions are present.",
    attempts: 0,
    successes: 0,
    failures: 0,
    alpha: 1,
    beta: 1,
    posterior: { successProbability: 0.5, evidenceMass: 0 },
    candidate: null,
    nextHint: "No evidence has been collected yet.",
    firstSeenAt: now,
    lastSeenAt: null,
    lastEvidence: ""
  };

  const prior = {
    alpha: route.alpha,
    beta: route.beta,
    successProbability: probability(route.alpha, route.beta)
  };
  route.attempts += 1;
  route.successes += succeeded ? 1 : 0;
  route.failures += succeeded ? 0 : 1;
  route.alpha += succeeded ? 1 : 0;
  route.beta += succeeded ? 0 : 1;
  route.posterior = {
    successProbability: probability(route.alpha, route.beta),
    evidenceMass: route.attempts
  };
  route.lastSeenAt = now;
  route.lastEvidence = clean(experience.evidence || experience.summary, 320);
  updateCandidate(route, experience);
  route.nextHint = nextHintFor(route);
  state.routes[key] = route;

  const update = {
    at: now,
    routeKey: key,
    context: route.context,
    hypothesis: route.hypothesis,
    prior,
    evidence: {
      outcome: succeeded ? "success" : "failure",
      summary: route.lastEvidence
    },
    posterior: route.posterior,
    candidate: route.candidate,
    nextHint: route.nextHint
  };
  state.totalEvidence = Number(state.totalEvidence || 0) + 1;
  state.updatedAt = now;
  state.recentUpdates = [update, ...state.recentUpdates].slice(0, 80);
  return { state, route, update };
}

export function formatBayesianExperienceContext(state = {}, agentId = "unknown", limit = 5) {
  const routes = Object.values(state.routes || {})
    .filter((route) => route.context?.agentId === agentId)
    .sort((left, right) => Number(right.attempts || 0) - Number(left.attempts || 0))
    .slice(0, limit);
  if (!routes.length) return "No Bayesian route evidence has been collected for this agent yet.";
  return routes.map((route) => [
    `${route.context.appId}/${route.context.action}`,
    `attempts=${route.attempts}`,
    `posterior=${route.posterior.successProbability}`,
    `BIU=${route.candidate?.retentionScore ?? "n/a"}`,
    `tier=${route.candidate?.tier ?? "unclassified"}`,
    `hint=${route.nextHint}`
  ].join("; ")).join("\n");
}
