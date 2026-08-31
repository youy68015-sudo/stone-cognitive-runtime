# Linux Runtime Portability v0

## Linux Local Smoke Test

`tools/test-linux-runtime-smoke.js` runs under WSL2 Ubuntu with Linux Node
`v22.22.1`. It uses an explicit writable Linux `/tmp` state root and verifies:

`suspend -> inspect -> fresh Linux process -> resume`

Dock, UI, Ollama, providers, and Windows state are not started or imported by
this test.

## Windows to Linux State Test

`tools/test-windows-linux-runtime-portability.js` is launched by Windows Node.
It writes a task plus evidence dependency to a temporary Windows state root,
maps that already-written root into WSL, and starts Linux Node to inspect and
resume it. The Linux worker verifies the exact saved next step, original
`win32` context, restored dependency state, and explicit non-automatic resume.

This confirms that the current JSON State Capsule and topology representation
survives the Windows-to-Linux filesystem boundary under WSL. It does not yet
test independent machines, network transport, node identity, reconnect, or
cross-node write-back. The test also asserts that the Runtime source hash is
unchanged during the portability exercise.
