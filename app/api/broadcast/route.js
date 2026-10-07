// app/api/broadcast/route.js
import dbConnect from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Broadcast from '@/lib/models/Broadcast';
import axios from 'axios';
import { NextResponse } from 'next/server';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

export async function POST(request) {
  try {
    await dbConnect();
    const { message, filters } = await request.json();
    
    console.log('📨 Broadcast Request:', { 
      messageLength: message?.length || 0,
      filters 
    });

    // ============================================
    // ✅ FIXED QUERY - Match your Lead model
    // ============================================
    
    let query = {};
    
    // ✅ Only leads with step: 'completed'
    // This matches your lead Patel who has step: 'completed'
    query.step = 'completed';
    
    // Optional filters (only if provided)
    if (filters?.city && filters.city.trim() !== '') {
      query.city = { $regex: new RegExp('^' + filters.city + '$', 'i') };
      console.log(`📍 Filtering by city: ${filters.city}`);
    }
    
    if (filters?.propertyType && filters.propertyType.trim() !== '') {
      query.propertyType = filters.propertyType;
      console.log(`🏠 Filtering by propertyType: ${filters.propertyType}`);
    }
    
    if (filters?.budgetRange && filters.budgetRange.trim() !== '') {
      query.budgetRange = filters.budgetRange;
      console.log(`💰 Filtering by budgetRange: ${filters.budgetRange}`);
    }
    
    console.log('🔍 Final Query:', JSON.stringify(query));
    
    // ============================================
    // FIND LEADS
    // ============================================
    
    const leads = await Lead.find(query);
    console.log(`📊 Found ${leads.length} leads matching query`);
    
    // Log the first lead found (for debugging)
    if (leads.length > 0) {
      console.log('📝 First lead found:', {
        name: leads[0].name,
        phone: leads[0].phone,
        step: leads[0].step,
        city: leads[0].city
      });
    }
    
    // ============================================
    // IF NO LEADS FOUND - SHOW DEBUG INFO
    // ============================================
    
    if (leads.length === 0) {
      // Get all leads to show what's available
      const allLeads = await Lead.find({});
      const allSteps = await Lead.distinct('step');
      const allCities = await Lead.distinct('city');
      
      console.log('📊 Database Summary:', {
        totalLeads: allLeads.length,
        allSteps,
        allCities,
        sampleLeads: allLeads.slice(0, 3).map(l => ({
          name: l.name,
          step: l.step,
          city: l.city,
          phone: l.phone
        }))
      });
      
      return NextResponse.json({ 
        success: false, 
        error: 'No leads found matching your criteria',
        debug: {
          totalLeadsInDB: allLeads.length,
          queryUsed: query,
          availableSteps: allSteps,
          availableCities: allCities,
          sampleLeads: allLeads.slice(0, 3).map(l => ({
            name: l.name,
            step: l.step,
            city: l.city,
            phone: l.phone ? '✅ has phone' : '❌ no phone'
          }))
        }
      }, { status: 400 });
    }
    
    // ============================================
    // GET RECIPIENTS (Phone Numbers)
    // ============================================
    
    const recipients = leads
      .map(lead => lead.phone)
      .filter(phone => phone && phone.length > 0);
    
    console.log(`📱 Valid phone numbers: ${recipients.length}`);
    
    if (recipients.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Leads found but none have valid phone numbers',
        debug: {
          leads: leads.map(l => ({
            name: l.name,
            phone: l.phone || 'MISSING',
            hasPhone: !!l.phone
          }))
        }
      }, { status: 400 });
    }
    
    // ============================================
    // CREATE BROADCAST
    // ============================================
    
    const broadcast = await Broadcast.create({
      message,
      recipients,
      filters,
      status: 'pending',
      totalRecipients: recipients.length,
    });
    
    // Send messages asynchronously
    sendBroadcastMessages(broadcast._id, recipients, message);
    
    return NextResponse.json({ 
      success: true, 
      broadcastId: broadcast._id,
      totalRecipients: recipients.length,
      recipients: recipients.slice(0, 5) // Show first 5 for debugging
    });
    
  } catch (error) {
    console.error('❌ Error creating broadcast:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to send broadcast: ' + error.message 
    }, { status: 500 });
  }
}

// ============================================
// SEND BROADCAST MESSAGES
// ============================================

async function sendBroadcastMessages(broadcastId, recipients, message) {
  let sentCount = 0;
  let failedCount = 0;
  
  console.log(`📤 Starting broadcast to ${recipients.length} recipients`);
  
  for (const phone of recipients) {
    try {
      await axios.post(
        graphMessagesUrl(getWhatsAppConfig().phoneNumberId),
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            Authorization: `Bearer ${getWhatsAppConfig().accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      sentCount++;
      console.log(`✅ Sent to ${phone} (${sentCount}/${recipients.length})`);
    } catch (error) {
      console.error(`❌ Failed to send to ${phone}:`, error.response?.data || error.message);
      failedCount++;
    }
    
    // Rate limiting - 1 second delay between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`📊 Broadcast complete: ${sentCount} sent, ${failedCount} failed`);
  
  await Broadcast.findByIdAndUpdate(broadcastId, {
    status: failedCount === 0 ? 'sent' : (sentCount > 0 ? 'partial' : 'failed'),
    sentCount,
    failedCount,
    sentAt: new Date()
  });
}

// ============================================
// GET BROADCASTS
// ============================================

export async function GET() {
  try {
    await dbConnect();
    const broadcasts = await Broadcast.find({}).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json(broadcasts || []);
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json([]);
  }
}

// ============================================
// DELETE BROADCAST
// ============================================

export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      await Broadcast.findByIdAndDelete(id);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Broadcast ID required' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    return NextResponse.json({ error: 'Failed to delete broadcast' }, { status: 500 });
  }
}