# ADR-008: Use ML-assisted detection, never autonomous authorization

**Status:** Accepted for incubation
**Decision:** Machine learning may rank or alert on suspicious activity after privacy and operational review; deterministic policy and human review retain authority over access changes.

## Consequences

This permits detection research without allowing false positives or manipulated inputs to create automatic privilege decisions. It requires measurable data quality, false-positive controls, drift monitoring, and incident ownership before deployment.
