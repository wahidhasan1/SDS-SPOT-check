"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { FieldHint, Label, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function FeedbackForm() {
  const toast = useToast();
  const [category, setCategory] = useState("idea");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api("/api/help/feedback", { body: { category, message } });
      setSent(true);
      setMessage("");
      toast({ tone: "success", title: "Thanks for your feedback!" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="fb-cat">Type</Label>
        <Select id="fb-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="idea">Idea</option>
          <option value="problem">Problem</option>
          <option value="praise">Praise</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="fb-msg">Message</Label>
        <Textarea id="fb-msg" value={message} onChange={(e) => { setMessage(e.target.value); setSent(false); }} maxLength={2000} aria-invalid={!!error} placeholder="What would make Pantora better for you?" />
        {error ? <FieldHint error>{error}</FieldHint> : <FieldHint>{sent ? "Received — thank you." : `${message.length}/2000`}</FieldHint>}
      </div>
      <Button type="submit" loading={loading} className="w-full">
        Send feedback
      </Button>
    </form>
  );
}
