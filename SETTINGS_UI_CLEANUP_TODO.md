# Settings Page UI Cleanup - TODO

## Issues to Fix

### 1. Remove Unnecessary Card Wrappers

**Tabs that need card wrapper removal:**
- **Users tab** (`value="users"`) - Line ~2071
- **Sync tab** (`value="qbo"`) - Line ~2241  
- **Project Info tab** (`value="project-info"`) - Line ~2940

**Pattern to apply:**
```tsx
// BEFORE:
<TabsContent value="users">
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>
      // content
    </CardContent>
  </Card>
</TabsContent>

// AFTER:
<TabsContent value="users" className="space-y-4">
  // content (no Card wrapper)
</TabsContent>
```

---

### 2. Project Info Schema - Convert to Sub-tabs

**Current Structure:**
- Project Info tab contains expandable/collapsible cards for each section
- Sections: General, COJ, JEA, etc.
- When user adds a new section, it appears as a new collapsible card

**Target Structure:**
- Project Info tab contains sub-tabs
- Each section becomes a sub-tab
- Sub-tabs: General, COJ, JEA, [New Section]...
- When user adds a section, it creates a new sub-tab
- Fields table appears in each sub-tab (no Card wrapper)

**Implementation Steps:**

1. **Add Tabs wrapper inside Project Info TabsContent:**
```tsx
<TabsContent value="project-info" className="space-y-4">
  <Tabs defaultValue={projectInfoSections[0]?.id.toString()}>
    <TabsList>
      {projectInfoSections.map(section => (
        <TabsTrigger key={section.id} value={section.id.toString()}>
          {section.title}
        </TabsTrigger>
      ))}
    </TabsList>
    
    {projectInfoSections.map(section => (
      <TabsContent key={section.id} value={section.id.toString()}>
        {/* Section controls and fields table */}
      </TabsContent>
    ))}
  </Tabs>
</TabsContent>
```

2. **Move "Add Section" input above TabsList**

3. **Remove the collapsible card wrapper** around each section

4. **Each sub-tab should contain:**
   - Section name edit input
   - Active/Inactive toggle
   - Fields table (with all columns)
   - Add field button

5. **State management:**
   - Track `selectedSectionId` for active tab
   - When new section created, switch to that tab
   - Remove `expandedProjectInfoSections` state (no longer needed)

---

## Benefits

**After cleanup:**
- ✅ Cleaner UI without redundant cards
- ✅ Better navigation with sub-tabs (no scrolling through collapsed sections)
- ✅ Consistent pattern with Schedule of Rates
- ✅ Easier to find specific agency/section
- ✅ More space for content

---

## Files to Modify

- `/src/app/(authenticated)/settings/page.tsx` - Main changes for all three issues

---

## Estimated Complexity

**Card Removal (Users, Sync):** Easy - 15 minutes
- Remove `<Card>`, `<CardHeader>`, `<CardContent>` wrappers
- Keep inner content

**Project Info Sub-tabs:** Medium - 45 minutes
- Restructure JSX with nested Tabs
- Update state management
- Test section addition/deletion
- Ensure drag-and-drop still works for fields

**Total:** ~1 hour

---

## Testing Checklist

After changes:
- [ ] Users tab displays correctly without card
- [ ] Sync tab displays correctly without card
- [ ] Project Info shows sub-tabs for each section
- [ ] Clicking sub-tab switches to that section
- [ ] Adding new section creates new sub-tab and switches to it
- [ ] Editing section title updates sub-tab label
- [ ] Deleting section removes sub-tab
- [ ] Fields table works in each sub-tab
- [ ] Drag-and-drop reordering still works
- [ ] Add field button works in each sub-tab
