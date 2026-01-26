# Federated Government Land Ledger Architecture

## Overview
Multi-organization, multi-channel Fabric network simulating federated government land registries:
- **CCLB** (Central Land Ledger Board): National authority, Property ID issuer
- **State Orgs** (TS, KA, AP, etc.): State-level registration authorities

## Channels

### cclb-global Channel
**Members**: CCLB + all State organizations  
**Chaincode**: `cclb-registry` (Go)  
**Data**:
- Property ID registry (issued by CCLB only)
- State-to-code mapping
- Cross-state verification records

### state-<code> Channels (e.g., state-ts)
**Members**: CCLB + specific State org (e.g., Telangana)  
**Chaincode**: `land-registry-state` (Go)  
**Data**:
- Full land records tied to CCLB Property IDs
- Ownership transfers
- Local verification signatures

## Property Lifecycle

1. **Registration (State)**
   - Citizen submits land details to State ledger
   - State creates draft record (no Property ID yet)

2. **ID Assignment (CCLB)**
   - CCLB chaincode generates globally unique Property ID
   - Record indexed in `cclb-global` channel
   - State chaincode references the ID

3. **Ownership Transfer**
   - Initiated on state channel
   - CCLB verifies via endorsement policy
   - Transaction recorded on both channels

## Backend APIs

### National Registry (CCLB)
- `GET /national/property/:id` — Fetch by CCLB Property ID
- `GET /national/properties` — List all indexed properties

### State Registry
- `GET /state/:stateCode/property/:id` — Fetch full state record
- `POST /state/:stateCode/property/create` — Submit registration (CCLB endorsement required)
- `POST /state/:stateCode/property/:id/transfer` — Request ownership change

## Endorsement Policies

- **Property ID Generation**: CCLB must endorse
- **State Record Creation**: State + CCLB signatures required
- **Ownership Transfer**: State + CCLB co-endorse
- **Cross-state Query**: CCLB verification acts as audit trail

## Frontend Flows

1. **Registry Scope Selector**
   - "National Index" → CCLB global view
   - "State Registry" → Dropdown to select state

2. **National View**
   - Displays Property ID, basic metadata
   - CCLB verification badge
   - Link to state details

3. **State View**
   - Full property details (owner, survey, location, area, value)
   - Chain of transfers
   - References CCLB Property ID

## Security Guarantees

- No single "master database" — all data replicated per channel membership
- Property IDs immutable once issued by CCLB
- State cannot forge Property IDs
- CCLB endorsement enforced by Fabric consensus
- Full audit trail on both channels
