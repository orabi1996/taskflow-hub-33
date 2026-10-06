import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ProjectContractRecord {
  id: string;
  contract_number: string;
  title: string;
  project_id: string;
  client_id: string | null;
  total_amount: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "completed" | "terminated";
  terms: string | null;
  created_at: string;
  updated_at: string;
  project?: { name: string } | null;
  client?: { name: string; company?: string | null } | null;
  invoices_count?: number;
  paid_amount?: number;
  collection_rate?: number;
}

export interface ContractInvoiceRecord {
  id: string;
  invoice_number: string;
  contract_id: string;
  project_id: string;
  client_id: string | null;
  milestone_title: string;
  amount: number;
  tax_amount: number;
  total_with_tax: number;
  currency: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  contract?: { contract_number: string; title: string } | null;
  project?: { name: string } | null;
  client?: { name: string; company?: string | null } | null;
}

/**
 * List all project contracts and milestones with calculated collection progress.
 */
export const listContractsAndInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: unknown) =>
    z
      .object({
        projectId: z.string().optional(),
        clientId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      })
      .optional()
      .parse(input)
  )
  .handler(async ({ data }) => {
    try {
      // 1. Fetch contracts
      let contractsQuery = (supabaseAdmin as any)
        .from("project_contracts")
        .select(`
          *,
          project:projects(name),
          client:clients(name, company)
        `);

      if (data?.projectId && data.projectId !== "all") {
        contractsQuery = contractsQuery.eq("project_id", data.projectId);
      }
      if (data?.clientId && data.clientId !== "all") {
        contractsQuery = contractsQuery.eq("client_id", data.clientId);
      }
      if (data?.status && data.status !== "all") {
        contractsQuery = contractsQuery.eq("status", data.status);
      }

      const { data: contracts, error: cErr } = await contractsQuery.order("created_at", { ascending: false });
      if (cErr) throw new Error(cErr.message);

      // 2. Fetch invoices
      let invoicesQuery = (supabaseAdmin as any)
        .from("contract_invoices")
        .select(`
          *,
          contract:project_contracts(contract_number, title),
          project:projects(name),
          client:clients(name, company)
        `);

      if (data?.projectId && data.projectId !== "all") {
        invoicesQuery = invoicesQuery.eq("project_id", data.projectId);
      }
      if (data?.clientId && data.clientId !== "all") {
        invoicesQuery = invoicesQuery.eq("client_id", data.clientId);
      }

      const { data: invoices, error: iErr } = await invoicesQuery.order("due_date", { ascending: true });
      if (iErr) throw new Error(iErr.message);

      // 3. Enrich contracts with invoice payment calculations
      const invoicesList = (invoices || []) as ContractInvoiceRecord[];
      const enrichedContracts = (contracts || []).map((c: any) => {
        const cInvoices = invoicesList.filter((inv) => inv.contract_id === c.id);
        const paidAmount = cInvoices
          .filter((inv) => inv.status === "paid")
          .reduce((sum, inv) => sum + Number(inv.total_with_tax || 0), 0);
        const total = Number(c.total_amount || 0);
        const collectionRate = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;

        return {
          ...c,
          invoices_count: cInvoices.length,
          paid_amount: paidAmount,
          collection_rate: collectionRate,
        } as ProjectContractRecord;
      });

      // Filter search if provided
      let filteredContracts: ProjectContractRecord[] = enrichedContracts;
      let filteredInvoices: ContractInvoiceRecord[] = invoicesList;

      if (data?.search && data.search.trim()) {
        const q = data.search.trim().toLowerCase();
        filteredContracts = filteredContracts.filter(
          (c: ProjectContractRecord) =>
            c.title.toLowerCase().includes(q) ||
            c.contract_number.toLowerCase().includes(q) ||
            (c.client?.name ? c.client.name.toLowerCase().includes(q) : false)
        );
        filteredInvoices = filteredInvoices.filter(
          (i: ContractInvoiceRecord) =>
            i.milestone_title.toLowerCase().includes(q) ||
            i.invoice_number.toLowerCase().includes(q) ||
            (i.client?.name ? i.client.name.toLowerCase().includes(q) : false)
        );
      }

      return {
        ok: true,
        contracts: filteredContracts,
        invoices: filteredInvoices,
      };
    } catch (err: any) {
      console.error("[listContractsAndInvoices] Error:", err);
      return { ok: false, error: err?.message || "تعذّر تحميل بيانات العقود والفواتير" };
    }
  });

/**
 * Create a new project contract.
 */
export const createProjectContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(255),
        projectId: z.string().uuid(),
        clientId: z.string().uuid().optional().nullable(),
        totalAmount: z.number().positive(),
        currency: z.string().default("SAR"),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        terms: z.string().optional().nullable(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const year = new Date().getFullYear();
      const rand = Math.floor(100 + Math.random() * 900);
      const contractNumber = `CNT-${year}-${rand}`;

      const { data: created, error } = await (supabaseAdmin as any)
        .from("project_contracts")
        .insert({
          contract_number: contractNumber,
          title: data.title,
          project_id: data.projectId,
          client_id: data.clientId || null,
          total_amount: data.totalAmount,
          currency: data.currency,
          start_date: data.startDate || null,
          end_date: data.endDate || null,
          terms: data.terms || null,
          status: "active",
        })
        .select()
        .single();

      if (error || !created) {
        throw new Error(error?.message || "فشل حفظ العقد");
      }

      return { ok: true, contract: created as ProjectContractRecord };
    } catch (err: any) {
      console.error("[createProjectContract] Error:", err);
      return { ok: false, error: err?.message || "تعذّر إنشاء العقد" };
    }
  });

/**
 * Create a new contract milestone invoice.
 */
export const createContractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contractId: z.string().uuid(),
        milestoneTitle: z.string().trim().min(3).max(255),
        amount: z.number().positive(),
        taxRate: z.number().default(0.15), // 15% VAT default
        dueDate: z.string(),
        notes: z.string().optional().nullable(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    try {
      // Fetch contract details to inherit project and client
      const { data: contract, error: cErr } = await (supabaseAdmin as any)
        .from("project_contracts")
        .select("project_id, client_id, currency")
        .eq("id", data.contractId)
        .single();

      if (cErr || !contract) throw new Error("العقد غير موجود");

      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${year}-${rand}`;

      const taxAmount = Number((data.amount * data.taxRate).toFixed(2));
      const totalWithTax = Number((data.amount + taxAmount).toFixed(2));

      const { data: created, error } = await (supabaseAdmin as any)
        .from("contract_invoices")
        .insert({
          invoice_number: invoiceNumber,
          contract_id: data.contractId,
          project_id: contract.project_id,
          client_id: contract.client_id,
          milestone_title: data.milestoneTitle,
          amount: data.amount,
          tax_amount: taxAmount,
          total_with_tax: totalWithTax,
          currency: contract.currency || "SAR",
          due_date: data.dueDate,
          notes: data.notes || null,
          status: "pending",
        })
        .select()
        .single();

      if (error || !created) throw new Error(error?.message || "فشل تسجيل الفاتورة");

      return { ok: true, invoice: created as ContractInvoiceRecord };
    } catch (err: any) {
      console.error("[createContractInvoice] Error:", err);
      return { ok: false, error: err?.message || "تعذّر تسجيل الفاتورة" };
    }
  });

/**
 * Record payment for an invoice.
 */
export const recordInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        paymentMethod: z.string().trim().min(2),
        paidAt: z.string().optional(),
        notes: z.string().optional().nullable(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const paidDate = data.paidAt || new Date().toISOString();
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("contract_invoices")
        .update({
          status: "paid",
          paid_at: paidDate,
          payment_method: data.paymentMethod,
          notes: data.notes ? data.notes.trim() : null,
        })
        .eq("id", data.invoiceId)
        .select("*, contract:project_contracts(title, contract_number)")
        .single();

      if (error || !updated) throw new Error(error?.message || "تعذّر تسجيل السداد");

      // In-app notification to finance / project admins
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: context.userId,
        type: "invoice_paid",
        title: `تم سداد الفاتورة #${updated.invoice_number} بنجاح`,
        body: `القيمة: ${updated.total_with_tax} ${updated.currency} عبر ${data.paymentMethod}`,
        link: "/billing",
      });

      return { ok: true, invoice: updated as ContractInvoiceRecord };
    } catch (err: any) {
      console.error("[recordInvoicePayment] Error:", err);
      return { ok: false, error: err?.message || "حدث خطأ أثناء اعتماد السداد" };
    }
  });
