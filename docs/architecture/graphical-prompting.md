# Graphical Prompting

Draw.io diagrams can serve as a **shared mutable workspace** between you and the agent — not just a static prompt, but something you both reason about and evolve across turns.

## How it works

Reference the `.drawio` file in your message (e.g. `@coding-agent-flow.drawio`). The agent reads the raw XML directly —
no special skills needed — and reasons about the graph structure, labels, and relationships as structured data.

The interaction is bidirectional: you edit the diagram in response to the agent's output; the agent reads the updated
file in the next prompt and continues from the new state. The diagram accumulates decisions and corrections like a collaborative whiteboard.

## Practical uses

- **Specify what to build** — draw a component diagram, sequence diagram, or flow; the agent implements against it
- **Audit code against intent** — share the intended architecture and ask whether the current codebase matches; gaps surface quickly
- **Iterative design** — challenge the agent's interpretation, update the diagram to correct it, re-prompt
