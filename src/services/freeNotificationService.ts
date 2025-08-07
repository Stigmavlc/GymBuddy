// Free SMS Alternatives for GymBuddy
// These actually work and are completely free!

export interface WhatsAppMessage {
  to: string; // Phone number with country code
  message: string;
}

export interface TelegramMessage {
  chatId: string;
  message: string;
}

class FreeMessagingService {
  
  // Method 1: WhatsApp Web API (Completely Free!)
  sendWhatsAppMessage(phone: string, message: string): boolean {
    try {
      // Format phone number (remove + and spaces)
      const cleanPhone = phone.replace(/[+\s\-()]/g, '');
      
      // Create WhatsApp Web URL
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp Web in new tab
      window.open(whatsappUrl, '_blank');
      
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  // Method 2: Telegram Bot API (Free with bot token)
  async sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
      return false;
    }
  }

  // Method 3: Email-to-SMS Gateway (Free if you know carriers)
  sendEmailToSMS(phone: string, carrier: 'att' | 'verizon' | 'tmobile' | 'sprint', message: string): boolean {
    const gateways = {
      att: 'txt.att.net',
      verizon: 'vtext.com', 
      tmobile: 'tmomail.net',
      sprint: 'messaging.sprintpcs.com'
    };

    const emailAddress = `${phone}@${gateways[carrier]}`;
    const subject = 'GymBuddy Alert';
    const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    
    window.open(mailtoUrl, '_blank');
    return true;
  }

  // Method 4: Direct SMS link (opens default SMS app)
  sendSMSLink(phone: string, message: string): boolean {
    try {
      const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
      return true;
    } catch (error) {
      console.error('Failed to open SMS app:', error);
      return false;
    }
  }
}

export const freeMessagingService = new FreeMessagingService();

// Message Templates
export const FREE_SMS_TEMPLATES = {
  AVAILABILITY_READY: (partnerName: string) => 
    `🏋️‍♂️ GymBuddy Alert: Both you and ${partnerName} have set availability! Check the app to schedule your workouts. 💪`,

  SESSION_CONFIRMED: (partnerName: string, day: string, time: string) => 
    `💪 GymBuddy: Your workout with ${partnerName} is confirmed for ${day} at ${time}. See you at the gym!`,

  SESSION_CANCELLED: (partnerName: string, day: string, time: string) => 
    `❌ GymBuddy: ${partnerName} cancelled your ${day} ${time} workout. Check the app to reschedule!`,

  SESSION_REMINDER: (partnerName: string, timeUntil: string) => 
    `⏰ GymBuddy Reminder: Your workout with ${partnerName} starts in ${timeUntil}. Time to get pumped! 🔥`
};