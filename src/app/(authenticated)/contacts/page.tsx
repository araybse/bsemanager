"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Phone,
  Mail,
  Building2,
  User,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  company: string | null;
  title: string | null;
  responsibilities: string[] | null;
  working_relationship: {
    interactionStyle?: string;
    responseTime?: string;
    preferredCommunication?: string;
    notes?: string;
  } | null;
  context: string | null;
  source_threads: string[] | null;
  confidence: number | null;
  last_updated: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const supabase = createClient() as any;

  useEffect(() => {
    loadContacts();
  }, [companyFilter]);

  async function loadContacts() {
    setLoading(true);
    let query = supabase
      .from("contact_profiles")
      .select("*")
      .order("name", { ascending: true });

    if (companyFilter !== "all") {
      query = query.eq("company", companyFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading contacts:", error);
    } else {
      setContacts(data || []);
      
      // Extract unique companies
      const uniqueCompanies = [
        ...new Set(
          (data || [])
            .map((c: Contact) => c.company)
            .filter(Boolean) as string[]
        ),
      ].sort();
      setCompanies(uniqueCompanies);
    }
    setLoading(false);
  }

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Contact Directory</h1>
          <p className="text-muted-foreground">
            All contacts extracted from email interactions
          </p>
        </div>
        <Button variant="outline" onClick={loadContacts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Contacts ({filteredContacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No contacts found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone (Mobile)</TableHead>
                  <TableHead>Phone (Office)</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          {contact.title && (
                            <div className="text-sm text-muted-foreground">
                              {contact.title}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.company ? (
                        <Badge variant="outline">{contact.company}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone_mobile ? (
                        <a
                          href={`tel:${contact.phone_mobile}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone_mobile}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone_office ? (
                        <a
                          href={`tel:${contact.phone_office}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Building2 className="h-3 w-3" />
                          {contact.phone_office}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge value={contact.confidence || 0} />
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedContact(contact)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Contact Details</DialogTitle>
                          </DialogHeader>
                          <ContactDetails contact={contact} />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = (value * 100).toFixed(0);
  let color = "bg-red-100 text-red-800";
  if (value >= 0.7) color = "bg-green-100 text-green-800";
  else if (value >= 0.5) color = "bg-yellow-100 text-yellow-800";

  return <Badge className={color}>{pct}%</Badge>;
}

function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Name
          </label>
          <div className="text-lg">{contact.name}</div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Title
          </label>
          <div>{contact.title || "-"}</div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Company
          </label>
          <div>{contact.company || "-"}</div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Email
          </label>
          <div>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="text-blue-600">
                {contact.email}
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Mobile Phone
          </label>
          <div>
            {contact.phone_mobile ? (
              <a href={`tel:${contact.phone_mobile}`} className="text-blue-600">
                {contact.phone_mobile}
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Office Phone
          </label>
          <div>
            {contact.phone_office ? (
              <a href={`tel:${contact.phone_office}`} className="text-blue-600">
                {contact.phone_office}
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>

      {contact.responsibilities && contact.responsibilities.length > 0 && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Responsibilities
          </label>
          <div className="flex flex-wrap gap-2 mt-1">
            {contact.responsibilities.map((r, i) => (
              <Badge key={i} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {contact.working_relationship && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Working Relationship
          </label>
          <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
            {contact.working_relationship.interactionStyle && (
              <div>
                <span className="text-muted-foreground">Style: </span>
                {contact.working_relationship.interactionStyle}
              </div>
            )}
            {contact.working_relationship.responseTime && (
              <div>
                <span className="text-muted-foreground">Response: </span>
                {contact.working_relationship.responseTime}
              </div>
            )}
            {contact.working_relationship.preferredCommunication && (
              <div>
                <span className="text-muted-foreground">Prefers: </span>
                {contact.working_relationship.preferredCommunication}
              </div>
            )}
          </div>
          {contact.working_relationship.notes && (
            <div className="mt-2 text-sm text-muted-foreground">
              {contact.working_relationship.notes}
            </div>
          )}
        </div>
      )}

      {contact.context && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Context
          </label>
          <div className="text-sm mt-1">{contact.context}</div>
        </div>
      )}

      {contact.source_threads && contact.source_threads.length > 0 && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Source Threads
          </label>
          <div className="text-sm text-muted-foreground mt-1">
            {contact.source_threads.length} email thread(s)
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Confidence: <ConfidenceBadge value={contact.confidence || 0} />
          </span>
          <span>
            Last updated:{" "}
            {contact.last_updated
              ? new Date(contact.last_updated).toLocaleDateString()
              : "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
