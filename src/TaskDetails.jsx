import { useState } from "react";
import { config } from "./config.js";
import {
  computeProgress,
  deadlineFromDateInput,
  formatDate,
  formatDeadline,
  toDateInputValue,
} from "./utils.js";

const { labels } = config;

export default function TaskDetails({ task, onChange, onComment }) {
  const [stepDraft, setStepDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const canEdit = typeof onChange === "function";
  const canComment = canEdit || typeof onComment === "function";
  const progress = computeProgress(task);
  const doneSteps = task.steps.filter((step) => step.done).length;

  function submitStep(event) {
    event.preventDefault();
    const text = stepDraft.trim();
    if (!text) return;
    onChange({ type: "addStep", text });
    setStepDraft("");
  }

  function submitComment(event) {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    if (canEdit) {
      onChange({ type: "addComment", text });
    } else {
      onComment(text);
    }
    setCommentDraft("");
  }

  return (
    <div className="task-details">
      {!canEdit && (
        <section className="details-section">
          <div className="details-head">
            <p className="details-title">{labels.summary}</p>
          </div>
          <dl className="summary-grid">
            <div>
              <dt>{labels.addedOn}</dt>
              <dd>{formatDate(task.createdAt)}</dd>
            </div>
            {task.completedAt && (
              <div>
                <dt>{labels.completedOn}</dt>
                <dd>{formatDate(task.completedAt)}</dd>
              </div>
            )}
            <div>
              <dt>{labels.deadline}</dt>
              <dd>{task.deadline ? formatDeadline(task.deadline) : labels.none}</dd>
            </div>
            <div>
              <dt>{labels.progress}</dt>
              <dd>{progress}%</dd>
            </div>
          </dl>
        </section>
      )}

      {canEdit && (
        <section className="details-section">
          <div className="details-head">
            <label className="details-title" htmlFor={`deadline-${task.id}`}>
              {labels.deadline}
            </label>
            {task.deadline && (
              <button
                type="button"
                className="btn btn-ghost comment-remove"
                onClick={() => onChange({ type: "setDeadline", value: null })}
              >
                {labels.removeDeadline}
              </button>
            )}
          </div>
          <input
            id={`deadline-${task.id}`}
            className="deadline-input"
            type="date"
            value={toDateInputValue(task.deadline)}
            onChange={(event) =>
              onChange({
                type: "setDeadline",
                value: deadlineFromDateInput(event.target.value),
              })
            }
          />
        </section>
      )}

      <section className="details-section">
        <div className="details-head">
          <p className="details-title">{labels.parts}</p>
          {task.steps.length > 0 && (
            <span className="details-value">
              {doneSteps}/{task.steps.length}
            </span>
          )}
        </div>

        {task.steps.length > 0 ? (
          <ul className="step-list">
            {task.steps.map((step) => (
              <li key={step.id} className={`step-item ${step.done ? "is-done" : ""}`}>
                <button
                  type="button"
                  className={`step-check ${step.done ? "is-checked" : ""}`}
                  onClick={() => canEdit && onChange({ type: "toggleStep", id: step.id })}
                  disabled={!canEdit}
                  aria-label={`${step.done ? "Reopen" : "Complete"} ${step.text}`}
                />
                <span className="step-text">{step.text}</span>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-ghost step-remove"
                    onClick={() => onChange({ type: "deleteStep", id: step.id })}
                    aria-label={`Remove part ${step.text}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="details-hint">
            {canEdit ? "Break the task into smaller parts to track it." : labels.noParts}
          </p>
        )}

        {canEdit && (
          <form className="inline-form" onSubmit={submitStep}>
            <input
              className="inline-input"
              type="text"
              value={stepDraft}
              onChange={(event) => setStepDraft(event.target.value)}
              placeholder={labels.addPart}
              maxLength={config.maxStepLength}
              aria-label={labels.addPart}
            />
            <button className="btn btn-small" type="submit" disabled={!stepDraft.trim()}>
              Add
            </button>
          </form>
        )}

        {canEdit && task.steps.length === 0 && (
          <div className="progress-editor">
            <div className="details-head">
              <label className="details-title" htmlFor={`progress-${task.id}`}>
                {labels.progress}
              </label>
              <span className="details-value">{progress}%</span>
            </div>
            <input
              id={`progress-${task.id}`}
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(event) =>
                onChange({ type: "setProgress", value: Number(event.target.value) })
              }
            />
          </div>
        )}
      </section>

      <section className="details-section">
        <div className="details-head">
          <p className="details-title">{labels.comments}</p>
          {task.comments.length > 0 && (
            <span className="details-value">{task.comments.length}</span>
          )}
        </div>

        {task.comments.length === 0 ? (
          <p className="details-hint">{labels.noComments}</p>
        ) : (
          <ul className="comment-list">
            {task.comments.map((comment) => (
              <li key={comment.id} className="comment-item">
                <p className="comment-text">{comment.text}</p>
                <div className="comment-foot">
                  <span className="comment-meta">
                    {comment.authorEmail ? `${comment.authorEmail} · ` : ""}
                    {formatDate(comment.createdAt)}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-ghost comment-remove"
                      onClick={() => onChange({ type: "deleteComment", id: comment.id })}
                    >
                      {labels.remove}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canComment && (
          <form className="inline-form" onSubmit={submitComment}>
            <input
              className="inline-input"
              type="text"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={labels.addComment}
              maxLength={config.maxCommentLength}
              aria-label={labels.addComment}
            />
            <button className="btn btn-small" type="submit" disabled={!commentDraft.trim()}>
              {labels.addCommentButton}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
