export async function repromptCurrentStep(from, lead, messengers) {
  const { sendWhatsAppMessage, sendInteractiveButtons, sendListMessage } = messengers;
  const name = lead.name || 'there';
  const lang = lead.preferredLanguage || 'en';

  switch (lead.step) {
    case 'askLanguage':
      await sendInteractiveButtons(from, '🌐 Please choose your preferred language.', [
        { id: 'en', title: 'English' },
        { id: 'hi', title: 'हिंदी' },
        { id: 'gu', title: 'ગુજરાતી' },
      ]);
      break;

    case 'askName':
      await sendWhatsAppMessage(from, '👋 Welcome to Heaven Homes!\n\n📝 To get started, may I know your full name?');
      break;

    case 'askPhone':
      await sendWhatsAppMessage(from, `Thank you, ${name}! 😊\n\n📱 Please share your contact number.`);
      break;

    case 'askEmail':
      await sendWhatsAppMessage(from, '📧 Please enter your email address.');
      break;

    case 'askCity':
      await sendWhatsAppMessage(from, '📍 Which city are you looking for a property in?');
      break;

    case 'askArea':
      await sendWhatsAppMessage(from, `📍 Which area or locality in ${lead.city || 'your city'}?`);
      break;

    case 'askPropertyCategory':
      await sendInteractiveButtons(from, 'Perfect! 🎉 How can we help you today?', [
        { id: 'purchase', title: '🏡 Buy Property' },
        { id: 'rent_lease', title: '🔑 Find a Rental' },
        { id: 'rent_out', title: '🏠 Rent Out' },
      ]);
      break;

    case 'askPurchaseType':
      await sendInteractiveButtons(from, '🏡 What type of property would you like to purchase?', [
        { id: 'residential_buy', title: '🏠 Residential' },
        { id: 'commercial_buy', title: '🏢 Commercial' },
      ]);
      break;

    case 'askResidentialPropertyType':
      await sendListMessage(from, 'Choose', 'Which type of residential property?', [
        { id: 'apartment', title: '🏢 Apartment / Flat' },
        { id: 'house', title: '🏡 Independent House' },
        { id: 'villa', title: '🏘️ Villa' },
        { id: 'builder_floor', title: '🏠 Builder Floor' },
        { id: 'studio', title: '🏙️ Studio Apartment' },
        { id: 'penthouse', title: '🌆 Penthouse' },
        { id: 'farmhouse', title: '🌳 Farmhouse' },
      ]);
      break;

    case 'askCommercialPropertyType':
      await sendListMessage(from, 'Choose', 'Which type of commercial property?', [
        { id: 'office', title: '🏢 Office Space' },
        { id: 'shop', title: '🛍️ Shop / Retail' },
        { id: 'showroom', title: '🏬 Showroom' },
        { id: 'warehouse', title: '🏭 Warehouse / Godown' },
        { id: 'industrial', title: '🏗️ Industrial / Factory' },
        { id: 'coworking', title: '💼 Co-working Space' },
      ]);
      break;

    case 'askCommercialSpaceSize':
      await sendListMessage(from, 'Choose', 'What size of commercial space?', [
        { id: 'upto_500', title: '📐 Up to 500 Sq.Ft.' },
        { id: '500_1000', title: '📐 500-1,000 Sq.Ft.' },
        { id: '1000_2000', title: '📐 1,000-2,000 Sq.Ft.' },
        { id: '2000_5000', title: '📐 2,000-5,000 Sq.Ft.' },
        { id: 'above_5000', title: '📐 Above 5,000 Sq.Ft.' },
      ]);
      break;

    case 'askRentType':
      await sendInteractiveButtons(from, '🔑 What type of property are you looking to rent?', [
        { id: 'residential', title: '🏠 Residential' },
        { id: 'commercial', title: '🏢 Commercial' },
      ]);
      break;

    case 'askConfiguration':
      await sendListMessage(from, 'Choose', 'Which configuration?', [
        { id: '1rk', title: '🏠 1 RK' },
        { id: '1bhk', title: '🏠 1 BHK' },
        { id: '2bhk', title: '🏠 2 BHK' },
        { id: '3bhk', title: '🏠 3 BHK' },
        { id: '4bhk', title: '🏠 4 BHK' },
        { id: '5bhk_plus', title: '🏠 5+ BHK' },
        { id: 'duplex', title: '🏘️ Duplex' },
        { id: 'triplex', title: '🏛️ Triplex' },
      ]);
      break;

    case 'askFurnishing':
      await sendInteractiveButtons(from, '🛋️ What furnishing option?', [
        { id: 'unfurnished', title: '🪑 Unfurnished' },
        { id: 'semi_furnished', title: '🛋️ Semi-Furnished' },
        { id: 'fully_furnished', title: '✨ Fully Furnished' },
      ]);
      break;

    case 'askRentBudget':
      await sendListMessage(from, 'Choose', 'What is your monthly rental budget?', [
        { id: 'below_10k', title: '💵 Below ₹10,000' },
        { id: '10k_20k', title: '💵 ₹10,000-₹20,000' },
        { id: '20k_40k', title: '💵 ₹20,000-₹40,000' },
        { id: 'above_40k', title: '💎 Above ₹40,000' },
      ]);
      break;

    case 'askBudget':
      await sendListMessage(from, 'Choose', 'What is your preferred budget?', [
        { id: '10L_30L', title: '💵 ₹10L – ₹30L' },
        { id: '30L_60L', title: '💵 ₹30L – ₹60L' },
        { id: '60L_1Cr', title: '💵 ₹60L – ₹1Cr' },
        { id: 'above_1Cr', title: '💎 Above ₹1Cr' },
      ]);
      break;

    case 'askPurchaseTimeline':
      await sendListMessage(from, 'Choose', 'When are you planning to purchase?', [
        { id: 'immediately', title: '🚀 Immediately' },
        { id: 'within_1_month', title: '📆 Within 1 Month' },
        { id: 'within_3_months', title: '🗓️ Within 3 Months' },
        { id: 'just_exploring', title: '👀 Just Exploring' },
      ]);
      break;

    case 'askSellFirstOrBuyDirect':
      await sendInteractiveButtons(from, 'Are you looking to buy directly, or sell first then buy?', [
        { id: 'buy_directly', title: '🏠 Buy directly' },
        { id: 'sell_then_buy', title: '💰 Sell then Buy' },
      ]);
      break;

    case 'askMoveInTimeline':
      await sendListMessage(from, 'Choose', 'When do you plan to move in?', [
        { id: 'immediately', title: '🚀 Immediately' },
        { id: 'within_15_days', title: '📆 Within 15 Days' },
        { id: 'within_1_month', title: '🗓️ Within 1 Month' },
        { id: 'just_exploring', title: '👀 Just Exploring' },
      ]);
      break;

    case 'showing_property':
      await sendWhatsAppMessage(from, 'Please use the buttons on the property card above, or type "restart" to start over.');
      break;

    case 'askSiteVisit':
      await sendInteractiveButtons(from, "Would you like to schedule a site visit?", [
        { id: 'yes', title: '✅ Yes, Book a Visit' },
        { id: 'no', title: '❌ Not Right Now' },
      ]);
      break;

    case 'askVisitDateTime':
      await sendWhatsAppMessage(from, 'Please share your preferred date and time.\n\n📅 Example: 28 July 2026, 🕒 11:00 AM');
      break;

    // ---- Lister steps ----
    case 'listPropertyType':
      await sendInteractiveButtons(from, "🏠 What type of property would you like to rent out?", [
        { id: 'residential', title: '🏠 Residential' },
        { id: 'commercial', title: '🏢 Commercial' },
      ]);
      break;

    case 'listResidentialSubType':
      await sendListMessage(from, 'Choose', '🏡 Please select your residential property type.', [
        { id: 'apartment', title: '🏢 Apartment / Flat' },
        { id: 'house', title: '🏠 Independent House' },
        { id: 'villa', title: '🏘️ Villa' },
        { id: 'builder_floor', title: '🏢 Builder Floor' },
        { id: 'pg', title: '🛏️ PG' },
        { id: 'farmhouse', title: '🌾 Farmhouse' },
      ]);
      break;

    case 'listCommercialSubType':
      await sendListMessage(from, 'Choose', 'Please select your commercial property type.', [
        { id: 'office', title: '🏢 Office Space' },
        { id: 'shop', title: '🛍️ Shop / Retail' },
        { id: 'showroom', title: '🏬 Showroom' },
        { id: 'warehouse', title: '🏭 Warehouse' },
        { id: 'coworking', title: '🏢 Co-working Space' },
        { id: 'factory', title: '🏭 Factory' },
      ]);
      break;

    case 'listLocation':
      await sendWhatsAppMessage(from, '📍 Where is your property located?\n\nPlease type City and Area/Locality. ✍️\nExample: Vijay Nagar, Indore');
      break;

    case 'listPrice':
      await sendWhatsAppMessage(from, '💰 What is your expected monthly rent?\n\n✍️ Example: ₹22,000 per month');
      break;

    case 'listFurnishing':
      await sendInteractiveButtons(from, '🛋️ What is the furnishing status?', [
        { id: 'unfurnished', title: '🪑 Unfurnished' },
        { id: 'semi_furnished', title: '🛋️ Semi-Furnished' },
        { id: 'fully_furnished', title: '✨ Fully Furnished' },
      ]);
      break;

    case 'listAvailability':
      await sendInteractiveButtons(from, '📅 When will your property be available?', [
        { id: 'available_now', title: '🚀 Available Now' },
        { id: 'within_15_days', title: '📆 Within 15 Days' },
        { id: 'next_month', title: '🗓️ Next Month' },
      ]);
      break;

    case 'listPhotos':
      await sendWhatsAppMessage(from, '📸 Please share 3–10 clear photos of your property.\n\nType *done* after 3+ photos to finish.');
      break;

    default:
      await sendWhatsAppMessage(from, `Hi ${name}! 👋\n\nLet's continue where you left off. Reply to proceed, or type "restart" to begin a new search.`);
      break;
  }
}