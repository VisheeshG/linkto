"use client";

import { useState } from "react";
import { ArrowRightLeft, FolderOpen, MoreHorizontal, Trash2 } from "lucide-react";
import { Project, Brand } from "@/lib/supabase";
import { Button, ConfirmDialog, Dialog, DropdownMenu, Field, Select, type MenuItem } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/format";

export type ProjectWithStats = Project & {
  linkCount: number;
  clickCount: number;
};

interface ProjectListProps {
  projects: ProjectWithStats[];
  brands?: Brand[];
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void | Promise<void>;
  onMoveToBrand?: (projectId: string, brandId: string | null) => void | Promise<void>;
}

export function ProjectList({
  projects,
  brands = [],
  onSelectProject,
  onDeleteProject,
  onMoveToBrand,
}: ProjectListProps) {
  const [pendingDelete, setPendingDelete] = useState<ProjectWithStats | null>(null);
  const [moving, setMoving] = useState<ProjectWithStats | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {projects.map((project) => {
          const items: MenuItem[] = [];
          if (onMoveToBrand) {
            items.push({
              label: "Move to brand…",
              icon: ArrowRightLeft,
              onSelect: () => {
                setMoveTarget(project.brand_id ?? "");
                setMoving(project);
              },
            });
          }
          items.push({
            label: "Delete project",
            description: "Deletes its links and click data",
            icon: Trash2,
            tone: "danger",
            onSelect: () => setPendingDelete(project),
          });

          return (
            <li key={project.id}>
              <article className="group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-300 focus-within:border-primary-300 sm:p-5">
                <div className="flex items-start gap-3">
                  <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-snug text-slate-900">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project)}
                        className="text-left break-words hover:text-primary-700 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-600">/{project.slug}</p>
                  </div>
                  <div className="relative z-20">
                    <DropdownMenu
                      label={`Actions for ${project.name}`}
                      items={items}
                      trigger={(props) => (
                        <button
                          {...props}
                          type="button"
                          aria-label={`More actions for ${project.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    />
                  </div>
                </div>

                {project.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{project.description}</p>
                )}

                <div aria-hidden className="min-h-4 flex-1" />
                <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                  <dl className="flex gap-5">
                    <div>
                      <dd className="text-base font-semibold tabular-nums text-slate-900">{formatNumber(project.linkCount)}</dd>
                      <dt className="text-xs text-slate-600">{project.linkCount === 1 ? "link" : "links"}</dt>
                    </div>
                    <div>
                      <dd className="text-base font-semibold tabular-nums text-slate-900">{formatNumber(project.clickCount)}</dd>
                      <dt className="text-xs text-slate-600">{project.clickCount === 1 ? "click" : "clicks"}</dt>
                    </div>
                  </dl>
                  <p className="text-xs text-slate-600">
                    Edited {formatRelative(project.updated_at || project.created_at) ?? "—"}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await onDeleteProject(pendingDelete.id);
        }}
        title="Delete this project?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong>, its {formatNumber(pendingDelete?.linkCount ?? 0)} links
            and all their click data will be permanently deleted. Tracking URLs
            already shared will stop working.
          </>
        }
        confirmLabel="Delete project"
      />

      <Dialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        dismissible={!moveBusy}
        title="Move project"
        description={moving ? `Choose a brand for “${moving.name}”.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoving(null)} disabled={moveBusy}>
              Cancel
            </Button>
            <Button
              loading={moveBusy}
              disabled={!moving || (moving.brand_id ?? "") === moveTarget}
              onClick={async () => {
                if (!moving || !onMoveToBrand) return;
                setMoveBusy(true);
                try {
                  await onMoveToBrand(moving.id, moveTarget || null);
                  setMoving(null);
                } finally {
                  setMoveBusy(false);
                }
              }}
            >
              Move
            </Button>
          </>
        }
      >
        <Field
          label="Brand"
          hint="Branded tracking URLs change to the new brand; legacy /project/… URLs keep working."
        >
          <Select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>
    </>
  );
}
