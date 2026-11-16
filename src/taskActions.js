import { computeProgress, createId } from "./utils.js";

export function withProgress(task) {
  return { ...task, progress: computeProgress(task) };
}

export function applyTaskAction(task, action) {
  switch (action.type) {
    case "addStep":
      return withProgress({
        ...task,
        steps: [...task.steps, { id: createId(), text: action.text, done: false }],
      });
    case "toggleStep":
      return withProgress({
        ...task,
        steps: task.steps.map((step) =>
          step.id === action.id ? { ...step, done: !step.done } : step
        ),
      });
    case "deleteStep":
      return withProgress({
        ...task,
        steps: task.steps.filter((step) => step.id !== action.id),
      });
    case "addComment":
      return {
        ...task,
        comments: [
          ...task.comments,
          { id: createId(), text: action.text, createdAt: new Date().toISOString() },
        ],
      };
    case "deleteComment":
      return {
        ...task,
        comments: task.comments.filter((comment) => comment.id !== action.id),
      };
    case "setProgress":
      return { ...task, progress: action.value };
    case "setDeadline":
      return { ...task, deadline: action.value };
    default:
      return task;
  }
}
