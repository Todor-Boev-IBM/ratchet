---
name: identify-low-value-tests
version: "2.0"
description: Identify low-value tests in a test file
argument-hint: <test-file-path>
metadata:
  disable-model-invocation: true
---

# Task

Analyze the test file at `$1` and identify tests that provide minimal value and could be candidates for removal.
Search related test files across the entire codebase to identify duplicate coverage.

## Low-Value Test Criteria

A test is considered low-value if it falls into one or more of these categories:

- **Tests standard library behavior** - Verifies that built-in language features or standard libraries work correctly
- **Tests simple one-liner methods** - Verifies trivial getters, setters, or pass-through functions with no logic
- **Tests the test setup itself** - Verifies test harness, mocks, or fixtures rather than production code
- **Subsumed by other tests** - Coverage already exists in other tests (same file, related test files, integration tests, or E2E tests)
- **Tests implementation details** - Brittle tests that break on refactoring without behavior changes
- **Excessive setup for trivial assertions** - High maintenance cost with minimal bug-finding value
- **Tests multiple unrelated concerns** - Makes failures ambiguous and harder to debug
- **Tests framework behavior** - Verifies that testing frameworks (e.g., Ginkgo, Gomega, JUnit) work correctly
- **Flaky timing dependencies** - Tests with hardcoded sleeps, race conditions, or unreliable timing assumptions
- **Tests obvious pass-through code** - Simple delegation or forwarding with no transformation logic

## Output Format

For each low-value test identified:

1. **Test name** - The exact test description string
2. **Location** - File path and line range
3. **Category** - Which low-value criteria it matches
4. **Rationale** - Specific explanation of why it's low-value
5. **Covered by** - List specific test files and test names that provide this coverage (use "N/A" if not applicable)
6. **Recommendation** - Remove, consolidate, or keep with modifications

If no low-value tests are found, state that clearly and explain why the existing tests are valuable.

### Example Output

```markdown
## Low-Value Tests Identified

### Test: "should handle concurrent updates correctly"

- **Location:** `internal/controller/reconciler_test.go:234-289`
- **Category:** Subsumed by other tests
- **Rationale:** Concurrency behavior is already tested with more comprehensive scenarios. This test duplicates that coverage.
- **Covered by:**
    - `internal/controller/creation_update_concurrency_test.go` - "should handle concurrent component creation and updates"
    - `test/e2e/e2e_test.go` - "Concurrent ComponentSet operations"
- **Recommendation:** Remove - coverage exists in dedicated concurrency test suite and E2E tests
```

## Guidelines

- Err on the side of keeping tests unless clearly redundant
- Integration tests may intentionally overlap with unit tests for confidence
- Consider the project's testing philosophy and risk tolerance
