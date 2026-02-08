"use client";

import { useRef } from "react";
import { updateTaskAssignee } from "@/app/actions";

type TaskAssigneeSelectProps = {
  taskId: string;
  assigneeId?: string | null;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
};

export function TaskAssigneeSelect({
  taskId,
  assigneeId,
  members,
}: TaskAssigneeSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateTaskAssignee} className="w-full sm:w-auto">
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="assigneeId"
        defaultValue={assigneeId ?? ""}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:w-auto"
        onChange={() => {
          formRef.current?.requestSubmit();
        }}
      >
        <option value="">Non assignée</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name || member.email || "Membre"}
          </option>
        ))}
      </select>
    </form>
  );
}
