import cron from 'node-cron';
import { QuotaService } from '../services/quota';

/**
 * Setup cron jobs for scheduled tasks
 * Runs quota reset daily at midnight UTC
 */
export function setupCronJobs() {
  // Reset quotas daily at midnight UTC (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🔄 Running scheduled quota reset...');
      const quotaService = new QuotaService();
      const resetCount = await quotaService.resetAllQuotas();
      console.log(`✅ Quota reset completed. Reset ${resetCount} user(s).`);
    } catch (error: any) {
      console.error('❌ Error in scheduled quota reset:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('📅 Cron job scheduled: Daily quota reset at 00:00 UTC');
}
