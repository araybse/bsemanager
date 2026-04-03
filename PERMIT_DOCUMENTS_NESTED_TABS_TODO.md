# Permit Documents - Nested Tabs Structure

## Current State (Partial Implementation)
- Started converting to nested tabs
- Agency level tabs created
- Need to complete permit level tabs and close nested structures

## Target Structure

```
Permit Documents (TabsContent)
├── Agency Tabs (First Level)
│   ├── COJ
│   ├── JEA  
│   ├── FDOT
│   └── ...
│
└── For each Agency Tab:
    ├── Permit Tabs (Second Level)
    │   ├── Permit 1
    │   ├── Permit 2
    │   └── ...
    │
    └── For each Permit Tab:
        ├── Add Document Form
        │   ├── Document Name Input
        │   ├── Type Dropdown (Application/Document/Plan)
        │   └── Add Document Button
        │
        └── Documents Table
            ├── Sort Order
            ├── Name (editable)
            ├── Type (dropdown)
            └── Actions (Move Up/Down, Delete)
```

## Implementation Notes

**Line ~3553:** Start of Permit Documents TabsContent

**Changes Needed:**
1. Close the permit-level TabsContent properly for each permit
2. Close the permit Tabs wrapper
3. Close the agency-level TabsContent for each agency
4. Close the agency Tabs wrapper
5. Update document filter: `(permitDocumentsCatalog || []).filter(d => d.permit_id === permit.id)`

**Nesting Level:**
- Level 1: Agencies and Permits Tab (main level)
- Level 2: Agency sub-tabs
- Level 3: Permit sub-tabs (within each agency)
- Level 4: Documents table (within each permit)

## Current Issue

The closing tags are not properly aligned. Need to:
1. Replace `selectedPermitDocuments` with filtered permitDocumentsCatalog
2. Add closing TabsContent for each permit
3. Add closing Tabs for permit level
4. Add closing TabsContent for each agency  
5. Add closing Tabs for agency level

## Recommended Approach

Due to complexity, manually edit the file in VS Code:
1. Find line ~3727 (closing TableBody/Table)
2. Replace the close structure with proper nesting
3. Test build after each level of closing tags

