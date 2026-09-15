# Known issues

No field-test issues have been recorded yet. The following verification items
remain open before the release gate.

Record every reproduced issue below with a host-visible symptom and a concrete workaround before the dry run is signed off.

| ID | Severity | Reproduced on | Host-visible symptom | Workaround | Verification status |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Medium | QA workspace, Node.js 23.10.0 | The runtime prints an engine warning because the project requires Node.js 24 LTS. | Run the final build, tests, smoke flow, and load harness under Node.js 24 before tagging the release. | Open; local behavior passed under Node.js 23.10.0. |
| QA-002 | Medium | QA workspace without a Docker daemon | The Docker image build and Compose startup cannot be verified here. | Run `docker build` and `docker compose config/up` on the deployment host or another machine with Docker available, then record the release identity. | Open; static Docker and Compose checks passed. |
