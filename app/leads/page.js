"use client";
import { useAuth } from "@/lib/auth/useAuth";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Search,
  Users,
  UserCheck,
  UserPlus,
  Phone,
  MapPin,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Star,
  Download,
  X,
  Loader2,
} from "lucide-react";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "new", label: "New" },
  { value: "follow_up", label: "Follow Up" },
  { value: "active", label: "Active" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "site_visit_scheduled", label: "Visit Scheduled" },
  { value: "site_visit_completed", label: "Visit Done" },
  { value: "re_visit", label: "Re-visit" },
  { value: "lost", label: "Lost" },
  { value: "converted", label: "Converted" },
];

const PROPERTY_CATEGORIES = [
  { value: "", label: "— Select —" },
  { value: "purchase", label: "Purchase" },
  { value: "rent_lease", label: "Rent / Lease" },
];

const PROPERTY_CLASS_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
];

const PROPERTY_SUBTYPE_OPTIONS = {
  residential_buy: [
    ["apartment", "Apartment / Flat"],
    ["house", "Independent House"],
    ["villa", "Villa"],
    ["builder_floor", "Builder Floor"],
    ["studio", "Studio Apartment"],
    ["penthouse", "Penthouse"],
    ["farmhouse", "Farmhouse"],
    ["plot", "Land / Plot"],
  ],
  commercial_buy: [
    ["office", "Office Space"],
    ["shop", "Shop / Retail"],
    ["showroom", "Showroom"],
    ["warehouse", "Warehouse / Godown"],
    ["industrial", "Industrial Land / Factory"],
    ["plot", "Land / Plot"],
    ["coworking", "Co-working Space"],
  ],
  residential_rent: [
    ["apartment", "Apartment / Flat"],
    ["house", "Independent House"],
    ["villa", "Villa"],
    ["builder_floor", "Builder Floor"],
    ["bunglow", "Bunglow"],
    ["pg", "PG (Paying Guest)"],
    ["farmhouse", "Farmhouse"],
  ],
  commercial_rent: [
    ["office", "Office Space"],
    ["shop", "Shop / Retail"],
    ["showroom", "Showroom"],
    ["warehouse", "Warehouse / Godown"],
    ["industrial", "Industrial Land / Factory"],
    ["coworking", "Co-working Space"],
  ],
  residential_rent_out: [
    ["apartment", "Apartment / Flat"],
    ["house", "Independent House"],
    ["villa", "Villa"],
    ["builder_floor", "Builder Floor"],
    ["pg", "PG"],
    ["farmhouse", "Farmhouse"],
  ],
  commercial_rent_out: [
    ["office", "Office Space"],
    ["shop", "Shop / Retail"],
    ["showroom", "Showroom"],
    ["warehouse", "Warehouse"],
    ["coworking", "Co-working Space"],
    ["factory", "Factory"],
  ],
};

const BUY_CONFIGURATIONS = [
  ["1bhk", "1 BHK"],
  ["2bhk", "2 BHK"],
  ["3bhk", "3 BHK"],
  ["4bhk", "4 BHK"],
  ["5bhk_plus", "5+ BHK"],
  ["duplex", "Duplex"],
];
const RENT_CONFIGURATIONS = [
  ["1bhk", "1 BHK"],
  ["2bhk", "2 BHK"],
  ["3bhk", "3 BHK"],
  ["4bhk", "4+ BHK"],
];
const BUY_BUDGETS = [
  ["30L_50L", "₹30L – ₹50L"],
  ["50L_75L", "₹50L – ₹75L"],
  ["75L_1Cr", "₹75L – ₹1Cr"],
  ["above_1Cr", "Above ₹1Cr"],
];
const RENT_BUDGETS = [
  ["15k_25k", "💵 ₹15,000-₹25,000"],
  ["25k_35k", "💵 ₹25,000-₹35,000"],
  ["35k_50k", "💵 ₹35,000-₹50,000"],
  ["above_50k", "💎 Above ₹50,000"],
];
const RENT_BUDGET_RANGES = {
  "15k_25k": "mid",
  "25k_35k": "high",
  "35k_50k": "luxury",
  above_50k: "luxury",
};
const RENT_OUT_BUDGETS = [
  ["low", "Below ₹10,000"],
  ["mid", "₹10,000–₹20,000"],
  ["high", "₹20,000–₹40,000"],
  ["luxury", "Above ₹40,000"],
];
const RENT_OUT_AVAILABILITY = [
  ["available_now", "🚀 Available Now"],
  ["within_15_days", "📆 Within 15 Days"],
  ["next_month", "🗓️ Next Month"],
];
const BUYING_PLANS = [
  ["immediately", "Immediately"],
  ["within_1_month", "Within 1 month"],
  ["1_3_months", "1–3 months"],
  ["3_6_months", "3–6 months"],
  ["just_exploring", "Just exploring"],
  ["sell_existing_first", "Need to sell my existing property first"],
];
const FURNISHING_OPTIONS = [
  ["unfurnished", "Unfurnished"],
  ["semi_furnished", "Semi-Furnished"],
  ["fully_furnished", "Fully Furnished"],
];
const COMMERCIAL_SETUP_OPTIONS = [
  ["bare_shell", "Bare Shell"],
  ["unfurnished", "Unfurnished"],
  ["semi_furnished", "Semi-Furnished"],
  ["fully_furnished", "Fully Furnished"],
];
const SPACE_SIZE_OPTIONS = [
  ["upto_500", "Up to 500 Sq.Ft."],
  ["500_1000", "500–1,000 Sq.Ft."],
  ["1000_2000", "1,000–2,000 Sq.Ft."],
  ["2000_5000", "2,000–5,000 Sq.Ft."],
  ["above_5000", "Above 5,000 Sq.Ft."],
];

export default function LeadsPage() {
  const { user, isOwner } = useAuth();
  const isChannelPartner = user?.role === "channel_partner";
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    followUp: 0,
    active: 0,
    converted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });

  // Add Lead modal
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaOptions, setAreaOptions] = useState([]);
  const [matchingProperties, setMatchingProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    phoneNumber: "",
    city: "Surat",
    area: "",
    leadType: "seeker",
    preferredLanguage: "en",
    propertyCategory: "",
    purchaseType: "",
    propertyType: "",
    propertySubType: "",
    rentTypeLabel: "",
    configuration: "",
    budgetRange: "",
    rentBudgetLabel: "",
    timeline: "",
    furnishing: "",
    investmentType: "",
    siteVisit: "",
    interested: "",
    spaceSize: "",
    currentStatus: "new",
    assignedTo: "",
  });
  const propertyClass = form.purchaseType.startsWith("commercial")
    ? "commercial"
    : "residential";
  const subtypeOptions = PROPERTY_SUBTYPE_OPTIONS[
    `${propertyClass}_${form.propertyCategory === "purchase" ? "buy" : form.propertyCategory === "rent_out" ? "rent_out" : "rent"}`
  ] || [];
  const configurationOptions = form.propertyType === "commercial"
    ? [["commercial", "Commercial"]]
    : form.leadType === "lister"
      ? form.configuration
        ? [[form.configuration, form.configuration.toUpperCase().replace("BHK", " BHK")]]
        : []
      : form.purchaseType.endsWith("_rent")
        ? RENT_CONFIGURATIONS
        : BUY_CONFIGURATIONS;
  const isRentLead = form.purchaseType.endsWith("_rent");
  const selectedRentBudget = RENT_BUDGETS.find(([, label]) => label === form.rentBudgetLabel)?.[0] || "";
  const budgetOptions = form.propertyCategory === "rent_out"
    ? RENT_OUT_BUDGETS
    : isRentLead
      ? RENT_BUDGETS
      : form.purchaseType.endsWith("_buy")
        ? BUY_BUDGETS
        : [];
  const furnishingOptions = form.propertyCategory === "rent_out" || form.purchaseType === "commercial_rent"
      ? (form.leadType === "lister" ? FURNISHING_OPTIONS : COMMERCIAL_SETUP_OPTIONS)
    : FURNISHING_OPTIONS;
  const propertyCriteriaReady = Boolean(
    form.area &&
    form.purchaseType &&
    form.propertySubType &&
    (form.propertySubType === "plot" || !configurationOptions.length || form.configuration) &&
    form.budgetRange &&
    (form.propertyCategory !== "rent_out" || form.timeline) &&
    (!form.purchaseType.endsWith("_rent") || form.furnishing) &&
    (!form.purchaseType.endsWith("_buy") || form.investmentType) &&
    (form.propertyType !== "commercial" || form.spaceSize)
  );

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/leads/stats");
      const json = await res.json();
      if (json.success) {
        setStats({
          total: json.data?.total ?? 0,
          followUp: json.data?.byStatus?.follow_up ?? 0,
          active: json.data?.active ?? 0,
          converted: json.data?.converted ?? 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      // Pass CRM status filter separately so backend can filter by currentStatus
      if (filterStatus) params.set("currentStatus", filterStatus);
      if (filterCity) params.set("city", filterCity);
      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
        setPagination((p) => ({ ...p, ...json.pagination }));
      } else {
        toast.error("Failed to fetch leads");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);
  useEffect(() => {
    fetchLeads(); /* eslint-disable-next-line */
  }, [pagination.page, filterStatus, filterCity]);

  useEffect(() => {
    if (!addOpen) return;

    let cancelled = false;
    const loadManualLeadOptions = async () => {
      try {
        const propertyResponse = await fetch('/api/properties?city=Surat&limit=200');
        const propertyJson = await propertyResponse.json();
        if (!propertyResponse.ok || !propertyJson.success) {
          throw new Error(propertyJson.error || 'Could not load Surat areas');
        }
        let teamJson = { data: [] };
        if (isOwner) {
          const teamResponse = await fetch('/api/team-members?role=channel_partner&active=true&limit=500');
          teamJson = await teamResponse.json();
          if (!teamResponse.ok || !teamJson.success) {
            throw new Error(teamJson.error || 'Could not load lead assignees');
          }
        }
        if (cancelled) return;
        setAreaOptions(
          [...new Set((propertyJson.data || []).map((property) => property.area).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b))
        );
        setAssigneeOptions((teamJson.data || []).map((member) => member.name).filter(Boolean));
        if (!isOwner && user?.name) {
          setForm((previous) => ({ ...previous, assignedTo: user.name }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load manual lead options:', error);
          toast.error(error.message || 'Failed to load lead options');
        }
      }
    };

    loadManualLeadOptions();
    return () => {
      cancelled = true;
    };
  }, [addOpen, isOwner, user?.name]);

  useEffect(() => {
    setForm((previous) => previous.interested
      ? { ...previous, interested: "" }
      : previous);
    setMatchingProperties([]);
    if (!addOpen || !propertyCriteriaReady) {
      setPropertiesLoading(false);
      return;
    }

    let cancelled = false;
    const loadMatchingProperties = async () => {
      setPropertiesLoading(true);
      try {
        const params = new URLSearchParams({
          city: "Surat",
          area: form.area,
          category: form.purchaseType,
          propertySubType: form.propertySubType,
          limit: "200",
        });
        if (form.configuration) params.set("configuration", form.configuration);

        const firstResponse = await fetch(`/api/properties?${params}`);
        const firstJson = await firstResponse.json();
        if (!firstResponse.ok || !firstJson.success) {
          throw new Error(firstJson.error || "Could not load matching properties");
        }

        const pages = firstJson.pagination?.pages || 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, pages - 1) }, (_, index) => {
            const pageParams = new URLSearchParams(params);
            pageParams.set("page", String(index + 2));
            return fetch(`/api/properties?${pageParams}`).then(async (response) => {
              const json = await response.json();
              if (!response.ok || !json.success) {
                throw new Error(json.error || "Could not load matching properties");
              }
              return json.data || [];
            });
          })
        );

        if (!cancelled) {
          setMatchingProperties([
            ...(firstJson.data || []),
            ...remainingPages.flat(),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load matching properties:", error);
          toast.error(error.message || "Failed to load matching properties");
        }
      } finally {
        if (!cancelled) setPropertiesLoading(false);
      }
    };

    loadMatchingProperties();
    return () => {
      cancelled = true;
    };
  }, [
    addOpen,
    propertyCriteriaReady,
    form.area,
    form.purchaseType,
    form.propertySubType,
    form.configuration,
  ]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lead deleted");
        setLeads((p) => p.filter((l) => l._id !== id));
        fetchStats();
      } else toast.error("Failed to delete");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleExport = () => {
    if (!filteredLeads?.length) {
      toast.error("No leads to export");
      return;
    }

    // Build CSV (opens natively in Excel; .csv keeps this dependency-free)
    const headers = [
      "Name",
      "Phone",
      "Email",
      "City",
      "Area",
      "Source",
      "Lead Type",
      "Property Category",
      "Budget",
      "Availability",
      "Furnishing",
      "Assigned To",
      "Status",
      "Created At",
    ];

    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = filteredLeads.map((lead) => {
      const statusKey = normalizeStatus(lead.currentStatus);
      const statusLabel =
        statusMap[statusKey]?.label ||
        (lead.currentStatus ? titleCase(lead.currentStatus) : "Unknown");
      return [
        lead.name || "",
        lead.phone || "",
        lead.email || "",
        lead.city || "",
        lead.area || "",
        lead.leadType === "lister" ? "Lister" : "Manual / WhatsApp",
        lead.leadType || "",
        lead.propertyCategory || "",
        lead.rentBudgetLabel || lead.budgetRange || "",
        lead.timeline || "",
        lead.furnishing || "",
        lead.assignedTo || "Unassigned",
        statusLabel,
        lead.createdAt
          ? new Date(lead.createdAt).toLocaleString("en-IN")
          : "",
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\n");

    // Add UTF-8 BOM so Excel detects encoding correctly (₹, emoji, etc.)
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Leads exported");
  };

  const openAddModal = () => {
    setForm({
      name: "",
      phone: "",
      phoneNumber: "",
      city: "Surat",
      area: "",
      leadType: "seeker",
      preferredLanguage: "en",
      propertyCategory: "",
      purchaseType: "",
      propertyType: "",
      propertySubType: "",
      rentTypeLabel: "",
      configuration: "",
      budgetRange: "",
      rentBudgetLabel: "",
      timeline: "",
      furnishing: "",
      investmentType: "",
      siteVisit: "",
      interested: "",
      spaceSize: "",
      currentStatus: "new",
      assignedTo: isOwner ? "" : user?.name || "",
    });
    setAddOpen(true);
  };

  const closeAddModal = () => {
    setAddOpen(false);
  };

  const handleAddSave = async () => {
    if (!form.phone.trim()) return toast.error("Phone is required");
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.propertyCategory) return toast.error("Select a property category");
    if (!form.purchaseType) return toast.error("Select residential or commercial");
    if (!form.propertySubType) return toast.error("Select a property subtype");
    if (!form.budgetRange) return toast.error("Select a budget");
    if (form.propertyCategory === "rent_out" && !form.timeline) {
      return toast.error("Select availability");
    }
    if (form.leadType === "seeker" && form.propertyType !== "commercial" && form.propertySubType !== "plot" && !form.configuration) {
      return toast.error("Select a configuration / BHK");
    }
    if (form.propertyType === "commercial" && !form.spaceSize) {
      return toast.error("Select a commercial space size");
    }
    if (form.purchaseType.endsWith("_rent") && !form.furnishing) {
      return toast.error("Select a furnishing / setup preference");
    }
    if (form.purchaseType.endsWith("_buy") && !form.investmentType) {
      return toast.error("Select a buying plan");
    }
    if (areaOptions.length && !form.area) return toast.error("Select an area");

    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          city: "Surat",
          phoneNumber: form.phoneNumber.trim() || form.phone.trim(),
          siteVisit: form.siteVisit ? new Date(form.siteVisit).toISOString() : "",
          source: "manual",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Lead added");
        closeAddModal();
        fetchLeads();
        fetchStats();
      } else {
        toast.error(
          json.message ||
            json.details?.join(", ") ||
            json.error ||
            "Failed to add lead"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add lead");
    } finally {
      setSaving(false);
    }
  };

  const setPropertyCategory = (propertyCategory) => {
    setForm((previous) => ({
      ...previous,
      propertyCategory,
      leadType: propertyCategory === 'rent_out' ? 'lister' : 'seeker',
      purchaseType: '',
      propertyType: '',
      propertySubType: '',
      rentTypeLabel: '',
      configuration: '',
      budgetRange: '',
      rentBudgetLabel: '',
      timeline: '',
      furnishing: '',
      investmentType: '',
      spaceSize: '',
      listingDraft: {},
    }));
  };

  const setPurchaseType = (propertyClass) => {
    if (!propertyClass) {
      setForm((previous) => ({
        ...previous,
        purchaseType: '',
        propertyType: '',
        propertySubType: '',
        rentTypeLabel: '',
        configuration: '',
      }));
      return;
    }

    const isLister = form.propertyCategory === 'rent_out';
    const suffix = form.propertyCategory === 'purchase' ? '_buy' : '_rent';
    const purchaseType = `${propertyClass}${suffix}`;
    setForm((previous) => ({
      ...previous,
      purchaseType,
      propertyType: propertyClass === 'commercial'
        ? 'commercial'
        : (purchaseType.endsWith('_rent') ? 'rent' : 'buy'),
      propertySubType: '',
      rentTypeLabel: purchaseType.endsWith('_rent')
        ? (propertyClass === 'commercial' ? 'Commercial' : 'Residential')
        : '',
      configuration: propertyClass === 'commercial' ? 'commercial' : '',
      budgetRange: '',
      rentBudgetLabel: '',
      timeline: '',
      furnishing: '',
      spaceSize: '',
      investmentType: '',
      listingDraft: isLister ? {} : previous.listingDraft,
    }));
  };

  const setPropertySubtype = (propertySubType) => {
    const isLister = form.propertyCategory === 'rent_out';
    const isCommercial = form.purchaseType.startsWith('commercial_');
    let configuration = '';
    if (isCommercial) configuration = 'commercial';
    else if (isLister) {
      configuration = ['pg', 'studio'].includes(propertySubType)
        ? '1bhk'
        : ['villa', 'farmhouse', 'penthouse'].includes(propertySubType)
          ? '4bhk'
          : '2bhk';
    } else if (propertySubType === 'plot' && form.purchaseType === 'residential_buy') {
      configuration = '';
    }

    setForm((previous) => ({
      ...previous,
      propertySubType,
      configuration,
      budgetRange: '',
      rentBudgetLabel: '',
    }));
  };

  const setBudget = (value) => {
    if (form.propertyCategory === 'rent_out') {
      setForm((previous) => ({ ...previous, budgetRange: value, rentBudgetLabel: '' }));
      return;
    }
    if (form.purchaseType.endsWith('_rent')) {
      const labels = Object.fromEntries(RENT_BUDGETS);
      setForm((previous) => ({
        ...previous,
        budgetRange: RENT_BUDGET_RANGES[value] || '',
        rentBudgetLabel: labels[value] || '',
      }));
      return;
    }
    setForm((previous) => ({ ...previous, budgetRange: value, rentBudgetLabel: '' }));
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(q) ||
      lead.phone?.includes(q) ||
      lead.city?.toLowerCase().includes(q) ||
      lead.area?.toLowerCase().includes(q)
    );
  });

  const statusMap = {
    new: { pillClass: "status-new", label: "New" },
    follow_up: { pillClass: "status-follow-up", label: "Follow Up" },
    active: { pillClass: "status-active", label: "Active" },
    contacted: { pillClass: "status-contacted", label: "Contacted" },
    interested: { pillClass: "status-interested", label: "Interested" },
    site_visit_scheduled: {
      pillClass: "status-site-visit-scheduled",
      label: "Visit Scheduled",
    },
    site_visit_completed: {
      pillClass: "status-site-visit-completed",
      label: "Visit Done",
    },
    re_visit: {
      pillClass: "status-site-visit-scheduled",
      label: "Re-visit",
    },
    lost: { pillClass: "status-lost", label: "Lost" },
    converted: { pillClass: "status-converted", label: "Converted" },
  };

  const DEFAULT_STATUS_STYLE = {
    pillClass: "status-unknown",
    label: "Unknown",
  };

  const titleCase = (str) =>
    String(str)
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const normalizeStatus = (status) => {
    if (!status) return "new";
    const value = String(status)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const aliases = {
      new: "new",
      follow_up: "follow_up",
      followup: "follow_up",
      followup_: "follow_up",
      active: "active",
      contacted: "contacted",
      interested: "interested",
      site_visit_scheduled: "site_visit_scheduled",
      sitevisitscheduled: "site_visit_scheduled",
      visit_scheduled: "site_visit_scheduled",
      visitscheduled: "site_visit_scheduled",
      site_visit_completed: "site_visit_completed",
      sitevisitcompleted: "site_visit_completed",
      visit_completed: "site_visit_completed",
      visitcompleted: "site_visit_completed",
      visit_done: "site_visit_completed",
      re_visit: "re_visit",
      revisit: "re_visit",
      not_interested: "lost",
      notinterested: "lost",
      lost: "lost",
      converted: "converted",
      closed: "converted",
      closed_won: "converted",
    };
    return aliases[value] || value;
  };

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Heading + action buttons */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a] flex items-center gap-2">
              <span className="w-2 h-7 sm:h-8 bg-[#2d7a3a] rounded-full mr-2 flex-shrink-0" />
              Leads Management
            </h1>
            <p className="text-sm text-[#4f6b4f] mt-1 ml-4">
              Manage and track all your leads
            </p>
          </div>

          {(isOwner || isChannelPartner) && (
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              {isOwner && (
                <button
                  onClick={handleExport}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f7ef] text-[#2d7a3a] border border-[#c9e5c3] px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              )}
              <button
                onClick={openAddModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Add Lead
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={Users} label="Total Leads" value={stats.total} tone="blue" />
        <KpiCard
          icon={Star}
          label="Follow Up"
          value={stats.followUp}
          tone="purple"
        />
        <KpiCard
          icon={UserPlus}
          label="Active Leads"
          value={stats.active}
          tone="amber"
        />
        <KpiCard
          icon={UserCheck}
          label="Converted Leads"
          value={stats.converted}
          tone="green"
        />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-3 sm:p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a7f6a]" />
            <input
              type="text"
              placeholder="Search by name, phone, city..."
              className="w-full pl-10 pr-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] md:w-52"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by city..."
            className="px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] md:w-44"
            value={filterCity}
            onChange={(e) => {
              setFilterCity(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm">
        <div className="responsive-table-wrapper overflow-x-auto">
          <table className="responsive-table w-full min-w-[900px] table-fixed">
            <thead>
              <tr className="bg-[#fafffa]">
                <Th>Lead Name</Th>
                <Th hidden>City / Area</Th>
                <Th>Budget</Th>
                <Th>Property Interest</Th>
                <Th>Source</Th>
                <Th>Assigned To</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-[#6a7f6a]">Loading leads...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td
                    colSpan={7}
                    className="text-center py-12 text-[#6a7f6a] text-sm"
                  >
                    <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const statusKey = normalizeStatus(lead.currentStatus);
                  const s = statusMap[statusKey] || {
                    ...DEFAULT_STATUS_STYLE,
                    label: lead.currentStatus
                      ? titleCase(lead.currentStatus)
                      : DEFAULT_STATUS_STYLE.label,
                  };
                  const interested = lead.interested;
                  const sourceLabel =
                    lead.source === "manual" || lead.leadType === "manual"
                      ? "Manual"
                      : lead.leadType === "lister"
                      ? "Lister"
                      : "WhatsApp";
                  const sourceTone =
                    sourceLabel === "Manual"
                      ? "bg-[#fef7e0] text-[#b68b40]"
                      : sourceLabel === "Lister"
                      ? "bg-[#f3e8ff] text-[#7a3aa8]"
                      : "bg-[#e8f5e6] text-[#2d7a3a]";

                  return (
                    <tr
                      key={lead._id}
                      className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors"
                    >
                      <td
                        className="px-5 py-3"
                        data-label="Lead"
                        data-full="true"
                      >
                        <p className="text-sm font-medium text-[#1a2e1a]">
                          {lead.name || "N/A"}
                        </p>
                        <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </p>
                      </td>

                      <td className="hidden px-5 py-3" data-label="City / Area">
                        <p className="text-sm text-[#4f6b4f] flex items-center gap-1 justify-start text-left">
                          <MapPin className="w-3 h-3 text-[#6a7f6a] shrink-0" />{" "}
                          {lead.city || "—"}
                        </p>
                        {lead.area && (
                          <p className="text-xs text-[#6a7f6a] text-left">
                            {lead.area}
                          </p>
                        )}
                      </td>

                      <td className="min-w-0 px-3 py-3" data-label="Budget">
                        <p
                          className="text-sm text-[#4f6b4f] text-left truncate"
                          title={lead.rentBudgetLabel || lead.budgetRange || "—"}
                        >
                          {lead.rentBudgetLabel || lead.budgetRange || "—"}
                        </p>
                      </td>

                      <td className="min-w-0 px-3 py-3" data-label="Property Interest">
                        {interested ? (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-[#f59e0b] fill-[#f59e0b]" />
                            <span
                              className="min-w-0 max-w-full text-sm text-[#1a2e1a] truncate"
                              title={interested.title}
                            >
                              {interested.title}
                            </span>
                          </div>
                        ) : lead.matchedProperties?.length > 0 ? (
                          <span className="text-xs text-[#6a7f6a]">
                            {lead.matchedProperties.length} matched
                          </span>
                        ) : (
                          <span className="text-xs text-[#6a7f6a]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3" data-label="Source">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${sourceTone}`}
                        >
                          {sourceLabel}
                        </span>
                      </td>

                      <td className="px-5 py-3" data-label="Assigned To">
                        <span className="text-sm text-[#4f6b4f]">
                          {lead.assignedTo || (
                            <span className="text-[#6a7f6a]">Unassigned</span>
                          )}
                        </span>
                      </td>

                      <td
                        className="px-5 py-3 align-middle"
                        data-label="Status"
                      >
                        <span
                          className={`
                            status-pill
                            inline-flex items-center justify-center
                            gap-1.5
                            min-w-[90px]
                            h-7
                            px-3
                            text-xs
                            font-semibold
                            rounded-full
                            border
                            whitespace-nowrap
                            ${s.pillClass}
                          `}
                        >
                          <span
                            className={`
                              status-dot
                              w-1.5 h-1.5
                              rounded-full
                              flex-shrink-0
                            `}
                          />
                          {s.label}
                        </span>
                      </td>

                      <td className="px-5 py-3" data-label="Action">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => router.push(`/leads/${lead._id}`)}
                            title="View"
                            className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#f0f7ef] hover:border-[#2d7a3a] transition-colors group"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleDelete(lead._id)}
                              title="Delete"
                              className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] transition-colors group"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#c0392b]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="px-3 sm:px-5 py-4 border-t border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between gap-2">
            <span className="text-xs text-[#6a7f6a]">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============ ADD LEAD MODAL ============ */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
          }}
          onClick={closeAddModal}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8f0e6] bg-[#fafffa] rounded-t-2xl sticky top-0 z-10">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1a2e1a]">
                  Add Lead Manually
                </h2>
                <p className="text-xs text-[#6a7f6a] mt-0.5">
                  Create a new lead with all fields
                </p>
              </div>
              <button
                onClick={closeAddModal}
                className="text-[#6a7f6a] hover:text-[#1a2e1a] flex-shrink-0 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g., Rajesh Kumar"
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="e.g., 9876543210"
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  />
                </Field>
                <Field label="City">
                  <select
                    value="Surat"
                    disabled
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-gray-100 text-gray-600"
                  >
                    <option value="Surat">Surat</option>
                  </select>
                </Field>
                <Field label="Area">
                  <select
                    value={form.area}
                    onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select area (optional)</option>
                    {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </Field>
                <Field label="Property Category">
                  <select
                    value={form.propertyCategory}
                    onChange={(e) => setPropertyCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    {PROPERTY_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.propertyCategory && (
                <Field label={form.propertyCategory === "purchase" ? "Purchase Type" : "Property Category"}>
                  <select
                    value={form.purchaseType ? propertyClass : ""}
                    onChange={(e) => setPurchaseType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select property class</option>
                    {PROPERTY_CLASS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                )}
                {form.purchaseType && (
                <Field label="Property Subtype">
                  <select
                    value={form.propertySubType}
                    onChange={(e) => setPropertySubtype(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select subtype</option>
                    {subtypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                )}
                {configurationOptions.length > 0 && form.propertySubType !== "plot" && (
                <Field label="Configuration / BHK">
                  <select
                    value={form.configuration}
                    onChange={(e) => setForm((p) => ({ ...p, configuration: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    {form.leadType === "lister" ? null : <option value="">Select configuration</option>}
                    {configurationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                )}
                {form.purchaseType && form.propertySubType && (
                <Field label="Budget">
                  <select
                    value={isRentLead ? selectedRentBudget : form.budgetRange}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select budget</option>
                    {budgetOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                )}
                {form.propertyCategory === "rent_out" && form.purchaseType && form.propertySubType && (
                <Field label="Availability">
                  <select
                    value={form.timeline}
                    onChange={(e) => setForm((p) => ({ ...p, timeline: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select availability</option>
                    {RENT_OUT_AVAILABILITY.map(([value, label]) => <option key={value} value={label}>{label}</option>)}
                  </select>
                </Field>
                )}
                {form.purchaseType.endsWith("_buy") && (
                <Field label="Buying Plan">
                  <select
                    value={form.investmentType}
                    onChange={(e) => setForm((p) => ({ ...p, investmentType: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select buying plan</option>
                    {BUYING_PLANS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                )}
                {form.purchaseType && form.propertyType === "commercial" && (
                <Field label="Commercial Space Size">
                  <select
                    value={form.spaceSize}
                    onChange={(e) => setForm((p) => ({ ...p, spaceSize: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select size</option>
                    {SPACE_SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                )}
                {form.purchaseType.endsWith("_rent") && (
                <Field label="Furnishing / Setup">
                  <select
                    value={form.furnishing}
                    onChange={(e) => setForm((p) => ({ ...p, furnishing: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">Select furnishing</option>
                    {furnishingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                )}
                {form.purchaseType && (
                <Field label="Preferred Site Visit Date and Time (optional)">
                  <input
                    type="datetime-local"
                    value={form.siteVisit}
                    onChange={(e) => setForm((p) => ({ ...p, siteVisit: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  />
                </Field>
                )}
                {isOwner ? (
                  <Field label="Assigned To">
                    <select
                      value={form.assignedTo}
                      onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Assigned To">
                    <input
                      value={user?.name || ""}
                      readOnly
                      className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-gray-100 text-gray-600"
                    />
                  </Field>
                )}
                <Field label="Current Status">
                  <select
                    value={form.currentStatus}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        currentStatus: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    {STATUS_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {propertyCriteriaReady && (
                <Field label="Property (optional)">
                  <select
                    value={form.interested}
                    onChange={(e) => setForm((p) => ({ ...p, interested: e.target.value }))}
                    disabled={propertiesLoading}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] disabled:bg-gray-100"
                  >
                    <option value="">
                      {propertiesLoading
                        ? "Loading matching properties..."
                        : matchingProperties.length
                          ? "Select property (optional)"
                          : "No matching properties"}
                    </option>
                    {matchingProperties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.propertyId || "Property"} - {property.internalName || property.title}
                      </option>
                    ))}
                  </select>
                </Field>
                )}
              </div>

            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-[#e8f0e6]">
              <button
                onClick={closeAddModal}
                className="w-full sm:w-auto px-4 py-2 text-sm text-[#4f6b4f] hover:bg-[#f0f7ef] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSave}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Lead"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = "left", hidden = false }) {
  const alignment = align === "right" ? "text-right" : "text-left";
  const cls = `${hidden ? "hidden " : ""}${alignment} px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider`;
  return <th className={cls}>{children}</th>;
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: { bg: "bg-[#e6f0fb]", fg: "text-[#2a6ba8]" },
    amber: { bg: "bg-[#fef7e0]", fg: "text-[#b68b40]" },
    green: { bg: "bg-[#e8f5e6]", fg: "text-[#2d7a3a]" },
    purple: { bg: "bg-[#f3e8ff]", fg: "text-[#7a3aa8]" },
  };
  const t = tones[tone] || tones.green;
  return (
    <div className="bg-white rounded-2xl border border-[#e8f0e6] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex items-center">
      <div className="flex items-center gap-3 w-full min-w-0">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 ${t.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${t.fg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-medium text-[#6a7f6a] uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[#1a2e1a] leading-tight mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}