"use client";

import { useRef } from "react";
import { updateTaskAssignee } from "@/app/actions";
import { AvatarSelect } from "@/components/ui/avatar-select";

type TaskAssigneeSelectProps = {
  taskId: string;
  assigneeId?: string | null;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
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
      <AvatarSelect
        name="assigneeId"
        defaultValue={assigneeId ?? ""}
        emptyLabel="Non assignée"
        triggerClassName="w-full sm:w-auto"
        options={members.map((member) => ({
          value: member.id,
          label: member.name || member.email || "Membre",
          imageUrl: member.image ?? null,
        }))}
        onValueChange={() => {
          window.requestAnimationFrame(() => {
            formRef.current?.requestSubmit();
          });
        }}
      />
    </form>
  );
}
