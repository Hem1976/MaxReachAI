"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/generator/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ContactList, ListMember } from "@/lib/crm/types";

type EditForm = {
  companyName: string;
  contactName: string;
  email: string;
};

function displayContact(member: ListMember) {
  const name = `${member.firstName} ${member.lastName}`.trim();
  return name || member.email || "—";
}

function memberToForm(member: ListMember): EditForm {
  return {
    companyName: member.companyName,
    contactName: displayContact(member),
    email: member.email,
  };
}

export function BulkListDetail({
  listId,
  onBack,
}: {
  listId: string;
  onBack: () => void;
}) {
  const [list, setList] = useState<ContactList | null>(null);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<ListMember | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lists/${listId}`);
      const data = (await response.json()) as {
        list?: ContactList;
        members?: ListMember[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not load this list.");
      setList(data.list ?? null);
      setMembers(data.members ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this list.");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const haystack = [member.companyName, member.email, member.firstName, member.lastName]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, query]);

  async function saveEdit() {
    if (!editMember || !editForm) return;
    if (!editForm.companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }
    setBusyId(editMember.contactId);
    try {
      const response = await fetch(
        `/api/lists/${listId}/members/${editMember.contactId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );
      const data = (await response.json()) as { member?: ListMember; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save changes.");
      if (data.member) {
        setMembers((current) =>
          current.map((member) =>
            member.contactId === data.member!.contactId ? data.member! : member,
          ),
        );
      }
      setEditMember(null);
      setEditForm(null);
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading list…
        </div>
      </section>
    );
  }

  if (!list) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <p className="text-sm text-muted-foreground">This list could not be found.</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
            <ArrowLeft />
            All lists
          </Button>
          <h2 className="display text-xl text-foreground">{list.name}</h2>
          {list.filename ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">{list.filename}</p>
          ) : null}
        </div>
        <Badge variant="outline" className="font-mono">
          {members.length} contacts
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, contact, or email…"
          aria-label="Search list"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-raised text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact person</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {members.length === 0 ? "This list has no contacts yet." : "No matches."}
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.contactId} className="hover:bg-surface-raised/60">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.companyName || "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{displayContact(member)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {member.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === member.contactId}
                        onClick={() => {
                          setEditMember(member);
                          setEditForm(memberToForm(member));
                        }}
                      >
                        <Pencil />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={Boolean(editMember && editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditMember(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit row</DialogTitle>
            <DialogDescription>
              Update the name, contact person, or email for this row.
            </DialogDescription>
          </DialogHeader>
          {editForm ? (
            <div className="grid gap-4 overflow-y-auto px-6 py-5">
              <Field label="Name" htmlFor="list-edit-company" hint="Required">
                <Input
                  id="list-edit-company"
                  value={editForm.companyName}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, companyName: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Contact person" htmlFor="list-edit-contact">
                <Input
                  id="list-edit-contact"
                  value={editForm.contactName}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, contactName: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Email" htmlFor="list-edit-email">
                <Input
                  id="list-edit-email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                  spellCheck={false}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditMember(null);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!editMember || busyId === editMember.contactId}
              onClick={() => void saveEdit()}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
