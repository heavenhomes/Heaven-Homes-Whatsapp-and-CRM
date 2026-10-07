import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check database connection
    if (!isDbConnected()) {
      await dbConnect();
    }
    
    // Get total leads
    const totalLeads = await Lead.countDocuments({});
    
    // Get completed leads
    const completedLeads = await Lead.countDocuments({ step: 'completed' });
    
    // Get active leads (not completed)
    const activeLeads = await Lead.countDocuments({ step: { $ne: 'completed' } });
    
    // Get leads by property category
    const purchaseLeads = await Lead.countDocuments({ propertyCategory: 'purchase' });
    const rentLeads = await Lead.countDocuments({ propertyCategory: 'rent_lease' });
    const investmentLeads = await Lead.countDocuments({ propertyCategory: 'investment' });
    
    // Get leads by city
    const cityStats = await Lead.aggregate([
      { $match: { city: { $ne: null, $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get leads with site visits
    const siteVisits = await Lead.countDocuments({ siteVisit: 'yes' });
    
    // Get leads by purchase type
    const residentialBuy = await Lead.countDocuments({ purchaseType: 'residential_buy' });
    const commercialBuy = await Lead.countDocuments({ purchaseType: 'commercial_buy' });
    const landPlotBuy = await Lead.countDocuments({ purchaseType: 'land_plot_buy' });
    const residentialRent = await Lead.countDocuments({ purchaseType: 'residential_rent' });
    const commercialRent = await Lead.countDocuments({ purchaseType: 'commercial_rent' });
    
    return NextResponse.json({
      success: true,
      data: {
        total: totalLeads,
        completed: completedLeads,
        active: activeLeads,
        byCategory: {
          purchase: purchaseLeads,
          rent: rentLeads,
          investment: investmentLeads
        },
        byPurchaseType: {
          residentialBuy,
          commercialBuy,
          landPlotBuy,
          residentialRent,
          commercialRent
        },
        siteVisits,
        topCities: cityStats
      }
    });
    
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}