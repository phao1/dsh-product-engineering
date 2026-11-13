# Third-party notice

The Product Engineering skill collection was created by Pawel Huryn and is distributed under the MIT License. The upstream copyright and license appear in [LICENSE](LICENSE).

This package adapts all 44 skills from the six packs at [phuryn/product-engineering, commit bdb2389c7636f6615c37fd66dd8518986284ec01](https://github.com/phuryn/product-engineering/tree/bdb2389c7636f6615c37fd66dd8518986284ec01). [The catalog](upstream/catalog.json) maps the original names to the DSH names. [The source inventory](upstream/source-files.json) records each imported path and its upstream SHA-256. [Upstream source credits](upstream/sources.json) identify earlier projects from which specific skills were adapted.

The port adapts invocation, tool selection, release authorization, workflow recording, and external provider setup for DeepSeek Harness. It preserves the upstream methods, receipts, and accompanying examples. Some support files are adapted for resource lookup and vendor integration. The copies in [vendor-guides](upstream/vendor-guides) record the original workflow text for the more extensive rewrites. Their CLI examples describe the original hosts. DSH does not load them as skills or execute their scripts on registration.

The optional vendor workflows still require the applicable services, credentials, dependencies, and workspace authorization. The legacy review wrapper remains available as historical source. The DSH review workflows use a separately configured fresh reviewer and an explicitly scoped review subject.
