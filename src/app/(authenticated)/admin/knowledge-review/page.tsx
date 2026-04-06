"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  RefreshCw,
  Edit,
  Eye,
  TrendingUp,
  Brain,
  Sparkles,
  ChevronRight,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

// Types
interface ReviewItem {
  id: number;
  memory_id: string;
  thread_id: string;
  original_extraction: any;
  quality_score: number;
  confidence: number;
  flag_reason: string;
  flags: string[];
  source_subject: string;
  source_from: string;
  source_date: string;
  source_preview: string;
  source_project: string;
  status: "pending" | "approved" | "edited" | "rejected" | "re_extracted";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  flagged_at: string;
}

interface Entity {
  type: string;
  id: string;
  name: string;
  confidence: number;
  context_in_source?: string;
}

interface Relationship {
  from_entity: string;
  relation: string;
  to_entity: string;
  confidence: number;
  context?: string;
}

interface Action {
  id: string;
  description: string;
  assignee?: { name: string; entity_id?: string };
  deadline?: string;
  status: string;
  priority: string;
  confidence: number;
}

interface Learning {
  id: number;
  pattern: string;
  pattern_type: string;
  applies_to: string;
  confidence_boost: number;
  times_validated: number;
  times_failed: number;
  active: boolean;
  created_at: string;
}

interface CorrectionStats {
  total_corrections: number;
  by_type: Record<string, number>;
  recent_24h: number;
  recent_7d: number;
  pending_reviews: number;
  active_learnings: number;
}

// Quality score color helper
function getQualityColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-yellow-600";
  return "text-red-600";
}

// Confidence bar component
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function KnowledgeReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [stats, setStats] = useState<CorrectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("queue");
  
  const supabase = createClient() as any;

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadItems(), loadLearnings(), loadStats()]);
    setLoading(false);
  }, [filter]);

  async function loadItems() {
    let query = supabase
      .from("cognitive_review_queue")
      .select("*")
      .order("flagged_at", { ascending: false })
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
  }

  async function loadLearnings() {
    const { data, error } = await supabase
      .from("evolution_learnings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (!error) {
      setLearnings(data || []);
    }
  }

  async function loadStats() {
    const { data, error } = await supabase.rpc("get_correction_stats");
    if (!error && data) {
      setStats(data[0] || null);
    }
  }

  async function handleApprove(item: ReviewItem) {
    const { error } = await supabase
      .from("cognitive_review_queue")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        review_notes: "Approved as-is",
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
      loadStats();
    }
  }

  async function handleReject(item: ReviewItem) {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    // Record the rejection as a correction
    await supabase.rpc("record_correction", {
      p_memory_id: item.memory_id,
      p_thread_id: item.thread_id,
      p_correction_type: "quality_override",
      p_before_value: { status: "flagged", quality: item.quality_score },
      p_after_value: { status: "rejected", quality: 0 },
      p_corrected_by: "austin@blackstone-eng.com", // TODO: Get from auth
      p_reason: rejectReason,
    });

    const { error } = await supabase
      .from("cognitive_review_queue")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        review_notes: rejectReason,
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedItem(null);
      loadStats();
    }
  }

  async function handleSaveEdit(item: ReviewItem, editedExtraction: any, corrections: any[]) {
    // Record each correction
    for (const correction of corrections) {
      await supabase.rpc("record_correction", {
        p_memory_id: item.memory_id,
        p_thread_id: item.thread_id,
        p_correction_type: correction.type,
        p_before_value: correction.before,
        p_after_value: correction.after,
        p_corrected_by: "austin@blackstone-eng.com", // TODO: Get from auth
        p_reason: correction.reason,
        p_field_path: correction.fieldPath,
      });
    }

    // Update the review queue
    const { error } = await supabase
      .from("cognitive_review_queue")
      .update({
        status: "edited",
        reviewed_at: new Date().toISOString(),
        review_notes: `Made ${corrections.length} correction(s)`,
        corrections_made: corrections.length,
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.filter((i) => i.id !== item.id));
      setEditDialogOpen(false);
      setSelectedItem(null);
      loadStats();
    }
  }

  async function toggleLearning(learning: Learning) {
    const { error } = await supabase
      .from("evolution_learnings")
      .update({ active: !learning.active })
      .eq("id", learning.id);
    
    if (!error) {
      loadLearnings();
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.source_subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_project?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_from?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Evolution Layer - Human Feedback Loop
          </h1>
          <p className="text-muted-foreground">
            Review AI extractions, make corrections, and help the system learn
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.pending_reviews}</div>
              <div className="text-sm text-muted-foreground">Pending Reviews</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total_corrections}</div>
              <div className="text-sm text-muted-foreground">Total Corrections</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.recent_24h}</div>
              <div className="text-sm text-muted-foreground">Last 24 Hours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.recent_7d}</div>
              <div className="text-sm text-muted-foreground">Last 7 Days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                {stats.active_learnings}
              </div>
              <div className="text-sm text-muted-foreground">Active Learnings</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue" className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Review Queue
            {stats?.pending_reviews ? (
              <Badge variant="secondary" className="ml-1">{stats.pending_reviews}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="learnings" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Learnings
          </TabsTrigger>
        </TabsList>

        {/* Review Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Flagged Extractions</CardTitle>
                  <CardDescription>
                    Memories flagged by the Reflector for human review
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p>No items need review at this time.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      onApprove={() => handleApprove(item)}
                      onEdit={() => {
                        setSelectedItem(item);
                        setEditDialogOpen(true);
                      }}
                      onReject={() => {
                        setSelectedItem(item);
                        setRejectDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learnings Tab */}
        <TabsContent value="learnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Learned Patterns
              </CardTitle>
              <CardDescription>
                Patterns the system has learned from corrections - these improve future extractions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {learnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No learnings yet. Make corrections to help the system learn!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Confidence Boost</TableHead>
                      <TableHead>Validated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learnings.map((learning) => (
                      <TableRow key={learning.id}>
                        <TableCell className="max-w-xs truncate">
                          {learning.pattern}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{learning.pattern_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{learning.applies_to}</Badge>
                        </TableCell>
                        <TableCell>+{(learning.confidence_boost * 100).toFixed(0)}%</TableCell>
                        <TableCell>
                          <span className="text-green-600">✓ {learning.times_validated}</span>
                          {learning.times_failed > 0 && (
                            <span className="text-red-600 ml-2">✗ {learning.times_failed}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={learning.active ? "default" : "secondary"}>
                            {learning.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleLearning(learning)}
                          >
                            {learning.active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {selectedItem && (
        <EditDialog
          item={selectedItem}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedItem(null);
          }}
          onSave={(extraction, corrections) => handleSaveEdit(selectedItem, extraction, corrections)}
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Extraction</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this extraction. This helps the system learn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Rejection (required)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Email is spam/noise, completely wrong extraction, duplicate..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => selectedItem && handleReject(selectedItem)}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Review Item Card Component
function ReviewItemCard({
  item,
  onApprove,
  onEdit,
  onReject,
}: {
  item: ReviewItem;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const extraction = item.original_extraction || {};
  const entities = extraction.layers?.understanding?.entities || [];
  const relationships = extraction.layers?.understanding?.relationships || [];
  const actions = extraction.layers?.understanding?.actions || [];

  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {item.source_project || "No Project"}
              </Badge>
              <span className={`text-sm font-medium ${getQualityColor(item.quality_score)}`}>
                Quality: {item.quality_score?.toFixed(1) || "N/A"}/10
              </span>
              <ConfidenceBar value={item.confidence || 0} />
            </div>
            
            <h3 className="font-medium">{item.source_subject || "No Subject"}</h3>
            <p className="text-sm text-muted-foreground">
              From: {item.source_from || "Unknown"} • {item.source_date ? format(new Date(item.source_date), "MMM d, yyyy h:mm a") : "Unknown date"}
            </p>
            
            <div className="mt-2 flex flex-wrap gap-1">
              {item.flags?.map((flag) => (
                <Badge key={flag} variant="secondary" className="text-xs">
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
            
            <p className="mt-2 text-sm text-muted-foreground italic">
              Flag reason: {item.flag_reason}
            </p>
          </div>
          
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onApprove} title="Approve as-is">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit & Correct">
              <Edit className="h-4 w-4 text-blue-600" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onReject} title="Reject">
              <XCircle className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Original Email Preview */}
            <div>
              <h4 className="font-medium text-sm mb-2">Original Email</h4>
              <div className="bg-muted p-3 rounded text-sm max-h-40 overflow-auto">
                {item.source_preview || "No preview available"}
              </div>
            </div>
            
            {/* Extracted Entities */}
            <div>
              <h4 className="font-medium text-sm mb-2">
                Entities ({entities.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {entities.map((entity: Entity, i: number) => (
                  <Badge key={i} variant="outline" className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{entity.type}:</span>
                    {entity.name}
                    <span className="text-xs opacity-50">({Math.round(entity.confidence * 100)}%)</span>
                  </Badge>
                ))}
                {entities.length === 0 && (
                  <span className="text-sm text-muted-foreground">No entities extracted</span>
                )}
              </div>
            </div>
            
            {/* Extracted Relationships */}
            <div>
              <h4 className="font-medium text-sm mb-2">
                Relationships ({relationships.length})
              </h4>
              <div className="space-y-1">
                {relationships.slice(0, 5).map((rel: Relationship, i: number) => (
                  <div key={i} className="text-sm flex items-center gap-1">
                    <span>{rel.from_entity}</span>
                    <ChevronRight className="h-3 w-3" />
                    <Badge variant="secondary" className="text-xs">{rel.relation}</Badge>
                    <ChevronRight className="h-3 w-3" />
                    <span>{rel.to_entity}</span>
                  </div>
                ))}
                {relationships.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{relationships.length - 5} more
                  </span>
                )}
              </div>
            </div>
            
            {/* Extracted Actions */}
            {actions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">
                  Action Items ({actions.length})
                </h4>
                <div className="space-y-1">
                  {actions.map((action: Action, i: number) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded">
                      <div className="flex justify-between">
                        <span>{action.description}</span>
                        <Badge variant={action.priority === "high" ? "destructive" : "secondary"}>
                          {action.priority}
                        </Badge>
                      </div>
                      {action.assignee && (
                        <span className="text-xs text-muted-foreground">
                          Assigned to: {action.assignee.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Edit Dialog Component
function EditDialog({
  item,
  open,
  onClose,
  onSave,
}: {
  item: ReviewItem;
  open: boolean;
  onClose: () => void;
  onSave: (extraction: any, corrections: any[]) => void;
}) {
  const extraction = item.original_extraction || {};
  const understanding = extraction.layers?.understanding || {};
  
  const [entities, setEntities] = useState<Entity[]>(understanding.entities || []);
  const [relationships, setRelationships] = useState<Relationship[]>(understanding.relationships || []);
  const [actions, setActions] = useState<Action[]>(understanding.actions || []);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [newEntity, setNewEntity] = useState({ type: "Person", name: "", confidence: 0.9 });

  // Track changes
  function recordCorrection(type: string, before: any, after: any, reason: string, fieldPath: string) {
    setCorrections(prev => [...prev, { type, before, after, reason, fieldPath }]);
  }

  function handleAddEntity() {
    if (!newEntity.name.trim()) return;
    const entity: Entity = {
      ...newEntity,
      id: newEntity.name.toLowerCase().replace(/\s+/g, "-"),
    };
    recordCorrection("entity_added", null, entity, `Added missing entity: ${entity.name}`, "layers.understanding.entities");
    setEntities([...entities, entity]);
    setNewEntity({ type: "Person", name: "", confidence: 0.9 });
  }

  function handleRemoveEntity(index: number) {
    const removed = entities[index];
    recordCorrection("entity_removed", removed, null, `Removed incorrect entity: ${removed.name}`, "layers.understanding.entities");
    setEntities(entities.filter((_, i) => i !== index));
  }

  function handleRemoveRelationship(index: number) {
    const removed = relationships[index];
    recordCorrection("relationship_removed", removed, null, `Removed incorrect relationship`, "layers.understanding.relationships");
    setRelationships(relationships.filter((_, i) => i !== index));
  }

  function handleRemoveAction(index: number) {
    const removed = actions[index];
    recordCorrection("action_removed", removed, null, `Removed incorrect action: ${removed.description}`, "layers.understanding.actions");
    setActions(actions.filter((_, i) => i !== index));
  }

  function handleSave() {
    const editedExtraction = {
      ...extraction,
      layers: {
        ...extraction.layers,
        understanding: {
          ...understanding,
          entities,
          relationships,
          actions,
        },
      },
    };
    onSave(editedExtraction, corrections);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Extraction</DialogTitle>
          <DialogDescription>
            Make corrections to help the system learn. Changes are tracked.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="entities">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="entities">
              Entities ({entities.length})
            </TabsTrigger>
            <TabsTrigger value="relationships">
              Relationships ({relationships.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions ({actions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="space-y-4">
            {/* Add new entity */}
            <div className="flex gap-2 items-end p-3 bg-muted rounded">
              <div className="flex-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={newEntity.type}
                  onValueChange={(v) => setNewEntity({ ...newEntity, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Person">Person</SelectItem>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Agency">Agency</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                    <SelectItem value="Permit">Permit</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                    <SelectItem value="Location">Location</SelectItem>
                    <SelectItem value="Deadline">Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2]">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newEntity.name}
                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                  placeholder="Entity name"
                />
              </div>
              <Button onClick={handleAddEntity} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Entity list */}
            <div className="space-y-2">
              {entities.map((entity, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entity.type}</Badge>
                    <span>{entity.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round(entity.confidence * 100)}%)
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveEntity(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="relationships" className="space-y-4">
            <div className="space-y-2">
              {relationships.map((rel, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{rel.from_entity}</span>
                    <Badge variant="secondary">{rel.relation}</Badge>
                    <span>{rel.to_entity}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveRelationship(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {relationships.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No relationships extracted
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="space-y-2">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{action.description}</span>
                      <Badge variant={action.priority === "high" ? "destructive" : "secondary"}>
                        {action.priority}
                      </Badge>
                    </div>
                    {action.assignee && (
                      <span className="text-xs text-muted-foreground">
                        Assigned to: {action.assignee.name}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveAction(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No action items extracted
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Corrections summary */}
        {corrections.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <h4 className="font-medium text-sm mb-2">Corrections to be recorded ({corrections.length})</h4>
            <ul className="text-sm space-y-1">
              {corrections.map((c, i) => (
                <li key={i} className="text-muted-foreground">
                  • {c.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={corrections.length === 0}>
            Save {corrections.length} Correction{corrections.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
