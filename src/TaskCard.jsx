import { config } from "./config.js";
import TaskDetails from "./TaskDetails.jsx";
import {
  computeProgress,
  formatDate,
  formatDeadline,
  isOverdue,
} from "./utils.js";

const { labels } = config;

function ProgressBar({ value }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function TaskCard({
  task,
  completed,
  expanded,
  onToggleExpand,
  onChange,
  onComment,
  onComplete,
  onReopen,
  onDelete,
  ownerEmail,
}) {
  const progress = computeProgress(task);
  const overdue = !completed && isOverdue(task.deadline);
  const doneSteps = task.steps.filter((step) => step.done).length;

  return (
    <li className={`task-card ${completed ? "is-done" : ""}`}>
      <div className="task-row">
        {completed ? (
          onReopen ? (
            <button
              className="check is-checked"
              onClick={onReopen}
              title="Restore this task to pending"
              aria-label={`Restore ${task.text} to pending`}
            >
              <span className="check-dot" />
            </button>
          ) : (
            <span className="check is-checked" aria-hidden="true">
              <span className="check-dot" />
            </span>
          )
        ) : onComplete ? (
          <button
            className="check"
            onClick={onComplete}
            title="Mark as complete"
            aria-label={`Complete ${task.text}`}
          >
            <span className="check-dot" />
          </button>
        ) : (
          <span className="check" aria-hidden="true">
            <span className="check-dot" />
          </span>
        )}

        <div className="item-body">
          {ownerEmail && <p className="owner-tag">{ownerEmail}</p>}
          <p className="item-text">{task.text}</p>
          <div className="task-meta">
            <span>
              {completed ? "Completed" : "Added"}{" "}
              {formatDate(completed ? task.completedAt : task.createdAt)}
            </span>
            {task.deadline && (
              <span className={`due ${overdue ? "is-overdue" : ""}`}>
                {overdue ? labels.overdue : labels.due} {formatDeadline(task.deadline)}
              </span>
            )}
            {task.steps.length > 0 && (
              <span>
                {doneSteps}/{task.steps.length} parts
              </span>
            )}
            {task.comments.length > 0 && (
              <span>
                {task.comments.length} {task.comments.length === 1 ? "note" : "notes"}
              </span>
            )}
          </div>
          <div className="progress-row">
            <ProgressBar value={progress} />
            <span className="progress-label">{progress}%</span>
          </div>
        </div>

        <div className="task-actions">
          <button
            className="btn btn-ghost"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            {expanded ? labels.hide : labels.details}
          </button>
          {completed && onReopen && (
            <button
              className="btn btn-ghost"
              onClick={onReopen}
              title="Move this task back to pending"
              aria-label={`Mark ${task.text} as pending`}
            >
              {labels.reopen}
            </button>
          )}
          {onDelete && (
            <button
              className="btn btn-ghost"
              onClick={onDelete}
              aria-label={`${completed ? "Remove" : "Delete"} ${task.text}`}
            >
              {completed ? labels.remove : labels.delete}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <TaskDetails
          task={task}
          onChange={onChange}
          onComment={onComment}
        />
      )}
    </li>
  );
}
