# IRIS Team Deployment Checklist

## Pre-Deployment (Week Before)

### Data Quality
- [ ] Run `node scripts/audit/validate-data-integrity.mjs`
- [ ] Fix any high-priority issues found
- [ ] Run `node scripts/audit/compare-with-quickbooks.mjs --export=audit.csv`
- [ ] Review audit report, ensure >95% confidence

### Testing
- [ ] Run `node scripts/audit/test-rls-policies.mjs`
- [ ] All RLS tests passing
- [ ] Manual test: Login as PM (verify filtered data)
- [ ] Manual test: Login as Employee (verify limited access)
- [ ] Test QB webhook (create test invoice, verify sync)

### Documentation
- [ ] Team training deck prepared
- [ ] Quick reference guide printed
- [ ] Support contact info shared

## Deployment Day

### Morning (8 AM)
- [ ] Announce: "IRIS launching today at 2 PM"
- [ ] Final sync with QuickBooks (ensure fresh data)
- [ ] Verify Vercel deployment status
- [ ] Create team accounts in IRIS
  - [ ] Austin (admin)
  - [ ] Wesley (project_manager)
  - [ ] Arber (employee)
  - [ ] [Add others...]

### Pre-Launch (1 PM)
- [ ] Register QB webhook (if not already done)
- [ ] Test webhook with dummy invoice
- [ ] Verify real-time sync working
- [ ] Check dashboard loads for all user types
- [ ] Confirm logo/branding looks good

### Launch (2 PM)
- [ ] Share login URL: https://bsemanager.vercel.app/
- [ ] Send credentials to each user
- [ ] Walk team through first login
- [ ] Demo key features:
  - Dashboard overview
  - Projects list
  - Timesheet entry
  - Real-time QB sync

### First Week
- [ ] Daily check-ins with team
- [ ] Monitor error logs
- [ ] Track sync success rate
- [ ] Gather feedback
- [ ] Fix any blockers immediately

## Success Criteria (2 Weeks)

- [ ] Zero sync errors for 7 consecutive days
- [ ] All team members logging in daily
- [ ] Time entries submitted through IRIS (not manual)
- [ ] No critical bugs reported
- [ ] Team reports "everything in one place"

## Monitoring

### Daily Checks
```bash
# Check sync health
node scripts/audit/validate-data-integrity.mjs

# Check for errors
tail -100 /var/log/iris-errors.log
```

### Weekly Checks
- Run full QB audit
- Review project financials
- Check for data discrepancies
- Verify webhooks still active

## Rollback Plan

If critical issues arise:
1. Keep QuickBooks as source of truth
2. Users revert to manual QB entry temporarily
3. Fix IRIS issues
4. Re-sync from QB
5. Re-launch when stable

## Support Contacts

- **Technical Issues:** [Your email]
- **QB Sync Problems:** Check `docs/QUICKBOOKS_WEBHOOKS.md`
- **Data Questions:** Run audit scripts first
- **Access Issues:** Reset via Supabase dashboard

---

**Phase 1 Complete When:**
✅ All checklist items done  
✅ 2 weeks stable  
✅ Team happy  
✅ Moving to Phase 2 planning
