"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, AlertCircle, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ReviewItem {
  id: number;
  thread_id: string;
  file_project: string;
  suggested_project: string | null;
  subject: string;
  preview: string;
  processed_date: string;
  status: "pending" | "approved" | "reassigned" | "deleted";
  issue_type: "misfiled" | "ambiguous" | "needs_review";
  metadata: {
    from?: string;
    date?: string;
    confidence?: number;
    category?: string;
  };
}

interface Project {
  id: number;
  project_number: string;
  name: string;
}

export default function KnowledgeReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient() as any;

  useEffect(() => {
    loadItems();
    loadProjects();
  }, [filter]);

  async function loadItems() {
    setLoading(true);
    let query = supabase
      .from("knowledge_review_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "pending") {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading review items:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  async function loadProjects() {
    const { data } = await supabase
      .from("projects")
      .select("id, project_number, name")
      .eq("is_archived", false)
      .order("project_number", { ascending: false });
    setProjects(data || []);
  }

  async function handleApprove(item: ReviewItem) {
    const { error } = await supabase
      .from("knowledge_review_queue")
      .update({
        status: "approved",
        final_project: item.file_project,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
    }
  }

  async function handleReassign(item: ReviewItem, newProject: string) {
    const { error } = await supabase
      .from("knowledge_review_queue")
      .update({
        status: "reassigned",
        final_project: newProject,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
    }
  }

  async function handleDelete(item: ReviewItem) {
    const { error } = await supabase
      .from("knowledge_review_queue")
      .update({
        status: "deleted",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.file_project?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const issueTypeColors = {
    misfiled: "bg-yellow-100 text-yellow-800",
    ambiguous: "bg-orange-100 text-orange-800",
    needs_review: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Review Queue</h1>
          <p className="text-muted-foreground">
            Review AI-extracted knowledge entries that need verification
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as "pending" | "all")}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="all">All Items</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {filter === "pending" ? "Pending Reviews" : "All Reviews"} (
              {filteredItems.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>All caught up! No items need review.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Current Project</TableHead>
                  <TableHead>Suggested</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium truncate max-w-[300px]">
                          {item.subject}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.metadata?.from} •{" "}
                          {item.processed_date
                            ? format(new Date(item.processed_date), "MMM d, yyyy")
                            : "Unknown"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.file_project}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.suggested_project ? (
                        <Badge variant="secondary">{item.suggested_project}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          (item.metadata?.confidence || 0) < 0.5
                            ? "text-red-600"
                            : "text-yellow-600"
                        }
                      >
                        {((item.metadata?.confidence || 0) * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={issueTypeColors[item.issue_type]}>
                        {item.issue_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(item)}
                          title="Approve as-is"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Select
                          onValueChange={(v) => handleReassign(item, v)}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="Move to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.slice(0, 20).map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.project_number}
                              >
                                {p.project_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          title="Delete/Skip"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Processing Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProcessingStats />
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessingStats() {
  const [stats, setStats] = useState<{
    total: number;
    processed: number;
    failed: number;
    needsReview: number;
  } | null>(null);
  const supabase = createClient() as any;

  useEffect(() => {
    async function loadStats() {
      const { count: processed } = await supabase
        .from("email_processing_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "processed");

      const { count: failed } = await supabase
        .from("email_processing_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { count: needsReview } = await supabase
        .from("email_processing_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "needs_review");

      setStats({
        total: (processed || 0) + (failed || 0) + (needsReview || 0),
        processed: processed || 0,
        failed: failed || 0,
        needsReview: needsReview || 0,
      });
    }
    loadStats();
  }, []);

  if (!stats) {
    return <div className="text-muted-foreground">Loading stats...</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold">{stats.total}</div>
        <div className="text-sm text-muted-foreground">Total Processed</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
        <div className="text-sm text-muted-foreground">Successful</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">{stats.needsReview}</div>
        <div className="text-sm text-muted-foreground">Needs Review</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        <div className="text-sm text-muted-foreground">Failed</div>
      </div>
    </div>
  );
}
