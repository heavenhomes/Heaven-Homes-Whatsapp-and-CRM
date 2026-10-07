export function touchLeadActivity(lead) {
  lead.lastActivityAt = new Date();
  if (lead.followUpStatus === 'sent') {
    lead.followUpStatus = 'responded';
  }
}

export function resetLeadProgress(lead) {
  const userName = lead.name;

  lead.step = 'askPropertyCategory';
  lead.leadType = 'seeker';
  lead.city = null;
  lead.area = null;
  
  lead.propertyCategory = null;
  lead.purchaseType = null;
  lead.propertyType = null;
  lead.propertySubType = null;
  lead.configuration = null;
  lead.budgetRange = null;
  lead.timeline = null;
  lead.furnishing = null;
  lead.investmentType = null;
  lead.siteVisit = null;
  lead.shiftingDate = null;
  lead.spaceSize = null;
  lead.rentTypeLabel = null;
  lead.rentBudgetLabel = null;
  lead.interested = null;
  lead.ownedPropertyDraft = null;
  lead.listingDraft = {};
  if (typeof lead.markModified === 'function') {
    lead.markModified('listingDraft');
  }
  lead.cityAttempts = 0;
  lead.areaAttempts = 0;
  lead.matchedProperties = [];
  lead.currentPropertyIndex = 0;
  lead.followUpCount = 0;
  lead.lastFollowUp = null;
  lead.stuckAtStep = null;
  lead.followUpStatus = 'pending';
  touchLeadActivity(lead);

  return userName;
}

export async function unsubscribeLead(lead) {
  lead.followUpStatus = 'unsubscribed';
  // Do NOT clear lastFollowUp — keep audit history.
  touchLeadActivity(lead);
  await lead.save();
}

export function isRestartAction(selectedOption, text) {
  return (
    selectedOption === 'restart' ||
    selectedOption === 'fu_restart' ||
    (text && ['restart', 'reset', 'start over'].includes(text.toLowerCase().trim()))
  );
}

export function isStopFollowUpAction(selectedOption, text) {
  return (
    selectedOption === 'close_followup' ||
    selectedOption === 'fu_stop' ||
    (text && ['close', 'stop', 'unsubscribe'].includes(text.toLowerCase().trim()))
  );
}

export function isContinueAction(selectedOption, text) {
  return (
    selectedOption === 'continue' ||
    selectedOption === 'fu_continue' ||
    (text && text.toLowerCase().trim() === 'continue')
  );
}