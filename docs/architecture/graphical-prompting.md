# Graphical Prompting

Text is not the only channel to the agent. For spatial or structural ideas, a draw.io diagram is faster and more
precise than prose. Staying in the natural medium for an idea keeps you in a better thinking mode for longer.

## How it works

Reference the `.drawio` file in your message (e.g. `@coding-agent-flow.drawio`). The agent reads the raw XML
and reasons about the graph structure, labels, and relationships as structured data. No special skills needed.

The interaction is bidirectional. You edit the diagram in response to the agent's output, the agent reads the
updated file in the next prompt and continues from the new state. The diagram accumulates decisions and
corrections like a collaborative whiteboard.

## Practical uses

- **Specify what to build** by drawing a component diagram or flow for the agent to implement against
- **Audit code against intent** by sharing the intended architecture and asking whether the current codebase matches
- **Iterate on design** by challenging the agent's interpretation, correcting the diagram, and re-prompting
