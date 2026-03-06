# DONACIONES.md — Donation System Technical Specification

## Project Context

**Fundación Rescate de Mascotas Chile** (RUT: 65.212.606-5) is a registered nonprofit dedicated to rescuing, rehabilitating, and rehoming animals in Talca, Chile. It has 50+ volunteers, active legal status, and is registered as a tax-deductible donor entity under Chilean Law N° 21.440.

This donation system is inspired by the flow at [Reforestemos](https://app.reforestemos.org/reforestar?step=1), adapted for animal rescue. The goal is to allow people to donate, gift, or sponsor foundation services with:
- A friendly, responsive multi-step wizard
- Real payment processing via Flow.cl
- Traceability: each donor can follow the rescue animal ("rescatín") they helped
- A downloadable digital certificate with a unique tracking code

---

## Tech Stack

| Component | Technology | Version/Plan |
|---|---|---|
| Framework | Astro (hybrid mode) | 5.15+ |
| Interactive frontend | React (islands) | 19+ |
| Styling | TailwindCSS | v4+ |
| Database | Supabase (PostgreSQL) | Free tier |
| Storage (photos) | Supabase Storage | Free tier (1GB) |
| Payments | Flow.cl | Commission only |
| Emails | Resend | Free tier (100/day) |
| PDF certificates | jsPDF | Client-side |
| Deploy | Vercel | Free tier (Hobby) |
| Language | TypeScript | 5.9+ |

**Fixed monthly cost: $0.** Only Flow's commission per transaction (~3.19% + IVA).

---

## Dependencies to Install

```bash
# SSR adapter for Vercel
yarn add @astrojs/vercel

# Supabase client
yarn add @supabase/supabase-js

# Flow.cl API client (community)
yarn add flowcl-node-api-client

# PDF certificate generation
yarn add jspdf

# Transactional emails
yarn add resend

# QR code for certificates
yarn add qrcode
yarn add -D @types/qrcode

# Icons for product cards (may already be installed)
yarn add react-icons
```

---

## Required Change in astro.config.mjs

```javascript
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'hybrid',      // Changed from "static" or undefined
  adapter: vercel(),      // New
  // ... rest of existing config stays the same
});
```

With `hybrid`, ALL existing pages remain static by default. Only the new donation pages and API routes will be dynamic (marked with `export const prerender = false`).

---

## Environment Variables

```env
# Supabase
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...       # SERVER-SIDE ONLY (API routes)

# Flow.cl
FLOW_API_KEY=your-api-key                  # SERVER-SIDE ONLY
FLOW_SECRET_KEY=your-secret-key            # SERVER-SIDE ONLY
FLOW_API_URL=https://sandbox.flow.cl/api   # Production: https://www.flow.cl/api

# Resend
RESEND_API_KEY=re_xxxxxxxx                 # SERVER-SIDE ONLY

# App
PUBLIC_SITE_URL=https://fund-res-mas.vercel.app
```

**Security rule:** Variables without the `PUBLIC_` prefix must NEVER appear in client-side code. Only in files inside `src/pages/api/` or in the server part of `.astro` files.

---

## File Structure

```
src/
├── pages/
│   ├── donar.astro                          # Donation wizard (mounts React island)
│   ├── seguimiento/
│   │   └── [codigo].astro                   # Public tracking page
│   ├── donacion/
│   │   └── confirmacion.astro               # Post-payment: certificate + code
│   └── api/
│       ├── crear-pago.ts                    # Creates Flow payment order
│       ├── flow-webhook.ts                  # Receives payment confirmation from Flow
│       ├── flow-return.ts                   # Post-payment return (checks status)
│       ├── productos.ts                     # GET: list of donation products
│       ├── keep-alive.ts                    # Cron job to prevent Supabase pause
│       └── donacion/
│           └── [codigo].ts                  # GET: tracking data for a donation
├── layouts/
│   └── components/
│       └── donation/
│           ├── DonationApp.tsx              # Main wizard component
│           ├── StepSelector.tsx             # Step 1: What do you want to donate?
│           ├── StepDetails.tsx              # Step 2: Quantity + recipient
│           ├── StepMessage.tsx              # Step 3: Personalized message
│           ├── StepPayment.tsx              # Step 4: Donor data + pay button
│           ├── StepConfirmation.tsx         # Step 5: Confirmation + certificate
│           ├── ProductCard.tsx              # Donation product card
│           ├── OrderSummary.tsx             # Sidebar with total
│           └── TrackingTimeline.tsx         # Rescue animal update timeline
├── lib/
│   ├── supabase.ts                          # Supabase client (server + client)
│   ├── flow.ts                              # Flow API utilities (sign requests, etc.)
│   ├── certificate.ts                       # PDF certificate generation with jsPDF
│   └── email.ts                             # Email templates and sending with Resend
```

**All donation pages and API routes must include:**
```typescript
export const prerender = false;
```

---

## Database Schema: Supabase (PostgreSQL)

### Table: productos
Catalog of things that can be donated.

```sql
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  precio INTEGER NOT NULL,          -- CLP (e.g.: 15000, 30000)
  imagen_url TEXT,
  icono TEXT,                        -- react-icon name (e.g.: "FaPaw", "FaHeart")
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,           -- sort order in wizard
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial data
INSERT INTO productos (nombre, slug, descripcion, precio, icono, orden) VALUES
  ('Rescate Animal', 'rescate', 'Fund the complete rescue of a street animal', 15000, 'FaPaw', 1),
  ('Esterilización', 'esterilizacion', 'Cover the cost of a spay/neuter for ethical population control', 30000, 'FaHeartbeat', 2),
  ('Desayuno Perruno', 'desayuno', 'Feed the dogs in downtown Talca for a day', 5000, 'FaBone', 3),
  ('Vacunación', 'vacunacion', 'Full vaccination for a rescue animal', 10000, 'FaSyringe', 4),
  ('Aporte Libre', 'aporte-libre', 'Donate any amount you wish', 0, 'FaHandHoldingHeart', 5);
```

### Table: rescatines
Foundation animals that can be assigned to donations.

```sql
CREATE TABLE rescatines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  especie TEXT DEFAULT 'perro',       -- 'perro' or 'gato'
  raza TEXT,
  edad_estimada TEXT,                  -- "2 years approx", "puppy"
  descripcion TEXT,
  foto_principal_url TEXT,
  estado TEXT DEFAULT 'en_rescate',   -- en_rescate, en_hogar_temporal, adoptado
  fecha_rescate DATE,
  ubicacion TEXT,                      -- "Talca centro", "Foster home Magisterio"
  disponible_apadrinamiento BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: donaciones
Record of each donation/payment.

```sql
CREATE TABLE donaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_seguimiento TEXT UNIQUE NOT NULL,   -- format: "RES-2026-XXXX"

  -- Product and amount
  producto_id UUID REFERENCES productos(id),
  cantidad INTEGER DEFAULT 1,
  monto_unitario INTEGER NOT NULL,
  monto_total INTEGER NOT NULL,              -- CLP

  -- Donor
  donante_nombre TEXT NOT NULL,
  donante_email TEXT NOT NULL,
  donante_rut TEXT,                           -- for tax certificate (Ley 21.440)

  -- Gift (optional)
  es_regalo BOOLEAN DEFAULT false,
  destinatario_nombre TEXT,
  destinatario_email TEXT,
  mensaje_personalizado TEXT,
  motivo_regalo TEXT,                         -- birthday, christmas, condolence, other

  -- Payment (Flow)
  flow_order TEXT,                            -- commerceOrder sent to Flow
  flow_token TEXT,                            -- token returned by Flow
  estado_pago TEXT DEFAULT 'pendiente',       -- pendiente, pagado, fallido, reembolsado
  fecha_pago TIMESTAMPTZ,
  flow_medio_pago TEXT,                       -- card, transfer, etc.

  -- Traceability
  rescatin_id UUID REFERENCES rescatines(id),
  asignacion_estado TEXT DEFAULT 'pendiente', -- pendiente, asignado, no_aplica

  -- Emails
  email_donante_enviado BOOLEAN DEFAULT false,
  email_destinatario_enviado BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: actualizaciones
Progress photos and notes for rescue animals (traceability).

```sql
CREATE TABLE actualizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescatin_id UUID REFERENCES rescatines(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,                       -- "First week in foster home"
  descripcion TEXT,
  foto_url TEXT,                              -- URL in Supabase Storage
  tipo TEXT DEFAULT 'update',                 -- update, rescate, adopcion, veterinario
  fecha TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Products: public read, server-only write
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read productos" ON productos FOR SELECT USING (true);

-- Rescue animals: public read, server-only write
ALTER TABLE rescatines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rescatines" ON rescatines FOR SELECT USING (true);

-- Donations: read only by code (via server API), server-only write
ALTER TABLE donaciones ENABLE ROW LEVEL SECURITY;
-- Do NOT create a public SELECT policy — access only via service_role from API routes

-- Updates: public read, server-only write
ALTER TABLE actualizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read actualizaciones" ON actualizaciones FOR SELECT USING (true);
```

### Supabase Storage

Create a public bucket called `fotos` for rescue animal and update images:
- Bucket: `fotos`
- Public: Yes (photos need to be web-accessible)
- Folders: `rescatines/`, `actualizaciones/`
- File size limit: 5MB (compressed photos)

---

## Donation Wizard Flow

### DonationApp.tsx — Global Wizard State

```typescript
// Wizard state managed with useReducer
interface DonationState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  // Step 1
  productoSeleccionado: Producto | null;
  // Step 2
  cantidad: number;
  esRegalo: boolean;
  destinatarioNombre: string;
  destinatarioEmail: string;
  // Step 3
  mensajePersonalizado: string;
  motivoRegalo: string;
  // Step 4
  donanteNombre: string;
  donanteEmail: string;
  donanteRut: string;
  // Step 5 (post-payment)
  codigoSeguimiento: string;
  estadoPago: 'idle' | 'procesando' | 'pagado' | 'fallido';
}

type DonationAction =
  | { type: 'SET_PRODUCTO'; payload: Producto }
  | { type: 'SET_CANTIDAD'; payload: number }
  | { type: 'SET_REGALO'; payload: boolean }
  | { type: 'SET_DESTINATARIO'; payload: { nombre: string; email: string } }
  | { type: 'SET_MENSAJE'; payload: { mensaje: string; motivo: string } }
  | { type: 'SET_DONANTE'; payload: { nombre: string; email: string; rut: string } }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_PAGO_RESULTADO'; payload: { codigo: string; estado: string } }
  | { type: 'RESET' };
```

### Step 1: What do you want to donate? (StepSelector.tsx)

- Fetch products from `/api/productos` (or directly from Supabase client with anon key)
- Display cards with icon, name, description, and price
- "Aporte Libre" card shows a custom amount input
- On select, advance to Step 2

**Visual design:** Grid cards (2 columns desktop, 1 mobile), subtle hover effect, react-icons, white background with border, selected card with foundation color border.

### Step 2: Quantity and Details (StepDetails.tsx)

- Quantity selector: preset buttons (1, 2, 5, 10) + custom input
- Toggle "Is this a gift?" → shows recipient fields (name, email)
- **Sidebar summary** (OrderSummary.tsx): always visible on desktop, collapsible on mobile
  - Selected product
  - Quantity × unit price
  - Total in CLP (formatted with thousands separator)

### Step 3: Personalize Your Message (StepMessage.tsx)

- Textarea for message that goes on the digital certificate
- Max 250 characters (like Reforestemos)
- If gift: occasion selector (Birthday, Christmas, Condolence, Thank You, Other)
- Mini certificate preview (optional, future improvement)

### Step 4: Donor Data + Payment (StepPayment.tsx)

- Form: Full name, Email, RUT (optional, with note "for tax certificate")
- Email validation, Chilean RUT validation (if provided)
- Terms acceptance checkbox
- Final order summary
- **"Pay with Flow" button**: on click:
  1. Validate form
  2. POST to `/api/crear-pago` with all data
  3. Receive Flow URL
  4. `window.location.href = flowPaymentUrl` (redirect to Flow)

### Step 5: Confirmation (StepConfirmation.tsx)

This step renders at `/donacion/confirmacion.astro`, not inside the React wizard. The user arrives here after paying on Flow.

- Checks payment status via `/api/flow-return`
- If paid: shows tracking code, download certificate PDF button, link to tracking page
- If failed: shows error message and retry option
- If pending: shows spinner and retries every 3 seconds

---

## API Routes — Detailed Implementation

### POST /api/crear-pago.ts

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { crearOrdenFlow } from '../../lib/flow';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_SITE_URL = import.meta.env.PUBLIC_SITE_URL;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();

  // 1. Validate required fields
  // data: { productoId, cantidad, montoTotal, donanteNombre, donanteEmail,
  //         donanteRut?, esRegalo, destinatarioNombre?, destinatarioEmail?,
  //         mensajePersonalizado?, motivoRegalo? }

  // 2. Generate unique tracking code
  const codigo = generarCodigoSeguimiento(); // "RES-2026-A7X3"

  // 3. Save donation in Supabase with "pendiente" status
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: donacion, error } = await supabase
    .from('donaciones')
    .insert({
      codigo_seguimiento: codigo,
      producto_id: data.productoId,
      cantidad: data.cantidad,
      monto_unitario: data.montoUnitario,
      monto_total: data.montoTotal,
      donante_nombre: data.donanteNombre,
      donante_email: data.donanteEmail,
      donante_rut: data.donanteRut || null,
      es_regalo: data.esRegalo,
      destinatario_nombre: data.destinatarioNombre || null,
      destinatario_email: data.destinatarioEmail || null,
      mensaje_personalizado: data.mensajePersonalizado || null,
      motivo_regalo: data.motivoRegalo || null,
      flow_order: codigo, // use tracking code as Flow commerceOrder
      estado_pago: 'pendiente'
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: 'Error creating donation' }), { status: 500 });

  // 4. Create payment order in Flow
  const flowResponse = await crearOrdenFlow({
    commerceOrder: codigo,
    subject: `Donación: ${data.productoNombre} x${data.cantidad}`,
    amount: data.montoTotal,
    email: data.donanteEmail,
    urlConfirmation: `${PUBLIC_SITE_URL}/api/flow-webhook`,
    urlReturn: `${PUBLIC_SITE_URL}/api/flow-return`
  });

  // 5. Save Flow token in the donation record
  await supabase
    .from('donaciones')
    .update({ flow_token: flowResponse.token })
    .eq('codigo_seguimiento', codigo);

  // 6. Return payment URL to frontend
  return new Response(JSON.stringify({
    paymentUrl: flowResponse.url + '?token=' + flowResponse.token,
    codigoSeguimiento: codigo
  }));
};

// Generates a code like "RES-2026-A7X3"
function generarCodigoSeguimiento(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RES-${year}-${random}`;
}
```

### POST /api/flow-webhook.ts

Flow sends a POST to this URL when a payment is confirmed (or fails). **This endpoint is called by Flow's servers, not by the user.**

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { consultarEstadoFlow } from '../../lib/flow';
import { enviarEmailConfirmacion, enviarEmailRegalo } from '../../lib/email';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request }) => {
  // Flow sends the token as form-data
  const formData = await request.formData();
  const token = formData.get('token') as string;

  // 1. Check payment status with Flow
  const paymentStatus = await consultarEstadoFlow(token);

  // 2. Find donation by commerceOrder
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: donacion } = await supabase
    .from('donaciones')
    .select('*')
    .eq('flow_order', paymentStatus.commerceOrder)
    .single();

  if (!donacion) return new Response('Not found', { status: 404 });

  if (paymentStatus.status === 2) {
    // PAYMENT SUCCESSFUL

    // 3. Update donation
    await supabase
      .from('donaciones')
      .update({
        estado_pago: 'pagado',
        fecha_pago: new Date().toISOString(),
        flow_medio_pago: paymentStatus.paymentData?.media || 'unknown'
      })
      .eq('id', donacion.id);

    // 4. Try to auto-assign a rescue animal
    const { data: rescatin } = await supabase
      .from('rescatines')
      .select('id')
      .eq('disponible_apadrinamiento', true)
      .limit(1)
      .single();

    if (rescatin) {
      await supabase
        .from('donaciones')
        .update({
          rescatin_id: rescatin.id,
          asignacion_estado: 'asignado'
        })
        .eq('id', donacion.id);
    }

    // 5. Send confirmation email to donor
    await enviarEmailConfirmacion(donacion);
    await supabase
      .from('donaciones')
      .update({ email_donante_enviado: true })
      .eq('id', donacion.id);

    // 6. If gift, send email to recipient
    if (donacion.es_regalo && donacion.destinatario_email) {
      await enviarEmailRegalo(donacion);
      await supabase
        .from('donaciones')
        .update({ email_destinatario_enviado: true })
        .eq('id', donacion.id);
    }

  } else if (paymentStatus.status === 3 || paymentStatus.status === 4) {
    // PAYMENT FAILED OR CANCELLED
    await supabase
      .from('donaciones')
      .update({ estado_pago: 'fallido' })
      .eq('id', donacion.id);
  }

  return new Response('OK', { status: 200 });
};
```

### GET /api/flow-return.ts

The user is redirected here by Flow after paying. Checks the status and redirects to the confirmation page.

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { consultarEstadoFlow } from '../../lib/flow';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) return redirect('/donar');

  // Check status with Flow
  const paymentStatus = await consultarEstadoFlow(token);

  // Find donation
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: donacion } = await supabase
    .from('donaciones')
    .select('codigo_seguimiento, estado_pago')
    .eq('flow_order', paymentStatus.commerceOrder)
    .single();

  if (!donacion) return redirect('/donar');

  // Redirect to confirmation with code
  return redirect(`/donacion/confirmacion?codigo=${donacion.codigo_seguimiento}`);
};
```

### GET /api/productos.ts

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const GET: APIRoute = async () => {
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('orden');

  return new Response(JSON.stringify(data || []), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### GET /api/donacion/[codigo].ts

```typescript
export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const GET: APIRoute = async ({ params }) => {
  const { codigo } = params;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get donation with rescue animal and updates
  const { data: donacion } = await supabase
    .from('donaciones')
    .select(`
      codigo_seguimiento, estado_pago, fecha_pago, monto_total,
      donante_nombre, es_regalo, destinatario_nombre,
      mensaje_personalizado, motivo_regalo,
      productos (nombre, descripcion, imagen_url),
      rescatines (
        nombre, especie, raza, edad_estimada, descripcion,
        foto_principal_url, estado, fecha_rescate,
        actualizaciones (titulo, descripcion, foto_url, tipo, fecha)
      )
    `)
    .eq('codigo_seguimiento', codigo)
    .eq('estado_pago', 'pagado')
    .single();

  if (!donacion) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  return new Response(JSON.stringify(donacion), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

---

## Flow.cl Integration — Technical Detail

### Library

Use `flowcl-node-api-client` (github.com/EstebanFuentealba/flowcl-node-api-client):

```typescript
// src/lib/flow.ts
import FlowApi from 'flowcl-node-api-client';

const flowApi = new FlowApi({
  apiKey: import.meta.env.FLOW_API_KEY,
  secretKey: import.meta.env.FLOW_SECRET_KEY,
  apiURL: import.meta.env.FLOW_API_URL // sandbox or production
});

export async function crearOrdenFlow(params: {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
}) {
  const response = await flowApi.send('payment/create', params, 'POST');
  // response: { url, token, flowOrder }
  return response;
}

export async function consultarEstadoFlow(token: string) {
  const response = await flowApi.send('payment/getStatus', { token }, 'GET');
  // response: { flowOrder, commerceOrder, status, ... }
  // status: 1=pending, 2=paid, 3=rejected, 4=cancelled
  return response;
}
```

### Payment Flow (Diagram)

```
[User in wizard]
    │
    ▼ clicks "Pay"
[Frontend] ──POST──► [/api/crear-pago]
                          │
                          ├─► INSERT donation in Supabase (status: pendiente)
                          ├─► POST payment/create to Flow API (signed with secretKey)
                          │       └─► Flow returns { url, token }
                          └─► Responds { paymentUrl, codigoSeguimiento }
    │
    ▼ window.location = paymentUrl
[Flow.cl] ◄── user pays (card, transfer, etc.)
    │
    ├─► POST to /api/flow-webhook (server-to-server)
    │       ├─► GET payment/getStatus → verify payment
    │       ├─► UPDATE donation in Supabase (status: pagado)
    │       ├─► Assign rescue animal
    │       └─► Send emails (Resend)
    │
    └─► Redirects user to /api/flow-return?token=XXX
            └─► Redirect to /donacion/confirmacion?codigo=RES-2026-A7X3
                    └─► Shows certificate + tracking code
```

### Flow Environments

| Environment | API URL | Web URL | Account |
|---|---|---|---|
| Sandbox | `https://sandbox.flow.cl/api` | `sandbox.flow.cl` | Test account (create separately) |
| Production | `https://www.flow.cl/api` | `flow.cl` | Foundation RUT 65.212.606-5 |

In sandbox, payments are simulated. You can test with test cards provided by Flow.

---

## PDF Certificate Generation

### src/lib/certificate.ts

Uses jsPDF on the client-side (user's browser):

```typescript
import jsPDF from 'jspdf';

interface CertificateData {
  codigoSeguimiento: string;
  donanteNombre: string;     // or destinatarioNombre if gift
  productoNombre: string;
  cantidad: number;
  montoTotal: number;
  mensajePersonalizado?: string;
  fechaPago: string;
}

export function generarCertificado(data: CertificateData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Logo (load from /images/logo.png as base64)
  // doc.addImage(logoBase64, 'PNG', x, y, width, height);

  // Title
  doc.setFontSize(24);
  doc.text('Certificado de Donación', 105, 50, { align: 'center' });

  // Subtitle
  doc.setFontSize(12);
  doc.text('Fundación Rescate de Mascotas Chile', 105, 60, { align: 'center' });
  doc.text('RUT: 65.212.606-5', 105, 67, { align: 'center' });

  // Data
  doc.setFontSize(14);
  doc.text(`Donante: ${data.donanteNombre}`, 30, 90);
  doc.text(`Donación: ${data.productoNombre} x${data.cantidad}`, 30, 100);
  doc.text(`Monto: $${data.montoTotal.toLocaleString('es-CL')} CLP`, 30, 110);
  doc.text(`Fecha: ${data.fechaPago}`, 30, 120);
  doc.text(`Código de seguimiento: ${data.codigoSeguimiento}`, 30, 130);

  // Custom message
  if (data.mensajePersonalizado) {
    doc.setFontSize(12);
    doc.text(data.mensajePersonalizado, 30, 150, { maxWidth: 150 });
  }

  // QR with tracking link (use qrcode library to generate base64)
  // doc.addImage(qrBase64, 'PNG', 140, 85, 40, 40);

  // Footer
  doc.setFontSize(10);
  doc.text('Tax-deductible entity under Ley N° 21.440', 105, 270, { align: 'center' });
  doc.text(`Verify at: ${PUBLIC_SITE_URL}/seguimiento/${data.codigoSeguimiento}`, 105, 277, { align: 'center' });

  return doc;
}
```

---

## Emails with Resend

### src/lib/email.ts

```typescript
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export async function enviarEmailConfirmacion(donacion: any) {
  await resend.emails.send({
    from: 'Fundación Rescate de Mascotas <donaciones@rescatedemascotas.org>',
    to: donacion.donante_email,
    subject: `¡Gracias por tu donación! Código: ${donacion.codigo_seguimiento}`,
    html: `
      <h1>¡Gracias por tu generosidad, ${donacion.donante_nombre}!</h1>
      <p>Tu donación ha sido procesada exitosamente.</p>
      <p><strong>Código de seguimiento:</strong> ${donacion.codigo_seguimiento}</p>
      <p><strong>Monto:</strong> $${donacion.monto_total.toLocaleString('es-CL')} CLP</p>
      <p>Puedes seguir el impacto de tu donación en:</p>
      <a href="${PUBLIC_SITE_URL}/seguimiento/${donacion.codigo_seguimiento}">
        Ver mi donación
      </a>
      <p>Descarga tu certificado desde el enlace anterior.</p>
      <hr>
      <p>Fundación Rescate de Mascotas Chile - RUT 65.212.606-5</p>
    `
  });
}

export async function enviarEmailRegalo(donacion: any) {
  await resend.emails.send({
    from: 'Fundación Rescate de Mascotas <donaciones@rescatedemascotas.org>',
    to: donacion.destinatario_email,
    subject: `${donacion.donante_nombre} te ha regalado un rescate animal 🐾`,
    html: `
      <h1>¡Hola ${donacion.destinatario_nombre}!</h1>
      <p>${donacion.donante_nombre} ha hecho una donación en tu nombre a la
         Fundación Rescate de Mascotas Chile.</p>
      ${donacion.mensaje_personalizado ? `<blockquote>${donacion.mensaje_personalizado}</blockquote>` : ''}
      <p><strong>Código de seguimiento:</strong> ${donacion.codigo_seguimiento}</p>
      <p>Puedes seguir el impacto de esta donación en:</p>
      <a href="${PUBLIC_SITE_URL}/seguimiento/${donacion.codigo_seguimiento}">
        Ver mi rescatín
      </a>
    `
  });
}
```

---

## Tracking Page: /seguimiento/[codigo].astro

Public SSR page that shows the status of a donation and its assigned rescue animal.

**Page content:**
1. **Header**: "Seguimiento de tu donación" + code
2. **Donation data**: type, amount, date, donor (or recipient)
3. **Assigned rescue animal** (if any): large photo, name, species, age, description, current status with colored badge
4. **Update timeline**: chronological list with photo, title, description, date. Ordered from most recent to oldest.
5. **If no rescue animal assigned yet**: message "Tu donación está siendo procesada. Pronto asignaremos un rescatín a tu aporte."
6. **Button**: "Descargar certificado" (generates PDF client-side)
7. **Footer**: foundation data

**Rescue animal status badges:**
- 🔴 `en_rescate` → "En proceso de rescate" (red badge)
- 🟡 `en_hogar_temporal` → "En hogar temporal" (yellow badge)
- 🟢 `adoptado` → "¡Adoptado!" (green badge)

---

## Implementation Workflow (Phases)

### Phase 0: Setup (Day 1)
- [ ] Create Supabase account (supabase.com)
- [ ] Create Supabase project, run table SQL
- [ ] Create Flow sandbox account (sandbox.flow.cl)
- [ ] Create Resend account (resend.com)
- [ ] `yarn add @astrojs/vercel @supabase/supabase-js flowcl-node-api-client jspdf resend qrcode react-icons`
- [ ] `yarn add -D @types/qrcode`
- [ ] Change `astro.config.mjs` to hybrid + vercel adapter
- [ ] Configure `.env` locally with all variables
- [ ] Configure variables in Vercel Dashboard
- [ ] Verify `yarn dev` and `yarn build` still work correctly
- [ ] Load initial data: products + 5-10 rescue animals with photos

### Phase 1: Backend API (Week 1)
- [ ] Create `src/lib/supabase.ts` (server + client)
- [ ] Create `src/lib/flow.ts` (signing and query utilities)
- [ ] Create `src/pages/api/productos.ts`
- [ ] Create `src/pages/api/crear-pago.ts`
- [ ] Create `src/pages/api/flow-webhook.ts`
- [ ] Create `src/pages/api/flow-return.ts`
- [ ] Create `src/pages/api/donacion/[codigo].ts`
- [ ] Create `src/pages/api/keep-alive.ts` + `vercel.json`
- [ ] Test complete payment cycle with Flow sandbox (curl/Postman)
- [ ] Verify donation is saved and updated correctly in Supabase

### Phase 2: Frontend Wizard (Week 2-3)
- [ ] Create `src/layouts/components/donation/DonationApp.tsx` with useReducer
- [ ] Implement StepSelector.tsx (Step 1)
- [ ] Implement StepDetails.tsx (Step 2) with OrderSummary.tsx
- [ ] Implement StepMessage.tsx (Step 3)
- [ ] Implement StepPayment.tsx (Step 4)
- [ ] Create `src/pages/donar.astro` mounting `<DonationApp client:load />`
- [ ] Create `src/pages/donacion/confirmacion.astro` (Step 5 post-payment)
- [ ] Connect frontend with API routes
- [ ] Test full flow: wizard → Flow sandbox → confirmation
- [ ] Responsive design (mobile first)

### Phase 3: Traceability (Week 3-4)
- [ ] Create `src/pages/seguimiento/[codigo].astro`
- [ ] Implement TrackingTimeline.tsx
- [ ] Rescue animal assignment logic in webhook
- [ ] Upload rescue animal photos to Supabase Storage
- [ ] Create some example updates
- [ ] Test tracking page with real data

### Phase 4: Certificates + Emails (Week 4)
- [ ] Implement `src/lib/certificate.ts` with jsPDF
- [ ] "Download certificate" button on confirmation and tracking pages
- [ ] Implement `src/lib/email.ts` with Resend
- [ ] Integrate email sending in webhook
- [ ] Test emails (donor + gift recipient)

### Phase 5: Production and Launch (Week 5)
- [ ] Create Flow production account (foundation RUT, Banco Estado)
- [ ] Change FLOW_API_URL to production in Vercel
- [ ] Real test payment ($350 CLP)
- [ ] Add "Donar" to navigation menu (src/config/menu.json)
- [ ] Update existing pages (regalaunrescate.mdx) to point to /donar
- [ ] Update CTA section
- [ ] Testing with foundation volunteers
- [ ] Final deploy

### Post-launch (Ongoing)
The foundation manages from the Supabase dashboard:
- Upload rescue animal updates (photos + notes)
- Assign rescue animals to pending donations
- View donation list

---

## Important Notes for Claude Code

1. **Do not touch existing static pages** — blog, about, contact, etc. should not be modified except to add links to /donar in the menu and CTAs.

2. **All new dynamic pages must have** `export const prerender = false` at the top of the file.

3. **Flow API keys are server-side ONLY** — never import in React components. Only in files inside `src/pages/api/`.

4. **Supabase has two clients:**
   - `PUBLIC_SUPABASE_ANON_KEY` → for public reads in the frontend (products, public rescue animals)
   - `SUPABASE_SERVICE_ROLE_KEY` → for writes in API routes (create donations, update statuses). NEVER in frontend.

5. **The Flow webhook may arrive BEFORE the user is redirected** to urlReturn. That's why the donation is saved as "pendiente" when creating the payment, not when confirming.

6. **Tracking code** must be readable and dictable over the phone: only uppercase letters (no I, O) and numbers (no 0, 1). Format: `RES-YYYY-XXXX`.

7. **Supabase free tier pauses** after 7 days of inactivity. Configure a Vercel Cron Job that runs a simple SELECT every 5 days. Create `vercel.json` in the project root:
```json
{
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 8 */5 * *"
    }
  ]
}
```
And create `src/pages/api/keep-alive.ts`:
```typescript
export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async () => {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
  const { count } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  return new Response(JSON.stringify({ ok: true, count }));
};
```

8. **Currency**: Everything in CLP (Chilean pesos). Flow minimum amount: $350 CLP.

9. **The foundation is a registered tax-deductible entity** under Ley N° 21.440. Certificates must include RUT 65.212.606-5.

10. **Visual design**: maintain consistency with the existing site. Use the same colors, typography, and TailwindCSS styling already defined in `src/config/theme.json` and the Tailwind plugins in `src/tailwind-plugin/`.
