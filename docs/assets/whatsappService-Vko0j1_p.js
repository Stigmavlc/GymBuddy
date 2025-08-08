const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/services-DekJxO-H.js","assets/auth-BNfNio64.js","assets/ui-vendor-CRP0iqJy.js","assets/react-vendor-DWv6uwxK.js","assets/utils-vendor-BZaDkFqu.js","assets/supabase-vendor-B9YYga7y.js"])))=>i.map(i=>d[i]);
import{_ as p}from"./supabase-vendor-B9YYga7y.js";import{s as y}from"./auth-BNfNio64.js";class b{getConfig(){return{evolutionApiUrl:"https://gymbuddy-evolution-ivan-9989ed3d8228.herokuapp.com",apiKey:"gymbuddy-secret-key-12345",instanceName:"gymbuddy-coordinator",n8nWebhookUrl:"https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy"}}async sendMessage(e,t){const a=this.getConfig();if(!a.evolutionApiUrl||!a.apiKey)return console.log("Evolution API not configured, falling back to WhatsApp Web"),this.sendMessageViaWeb(e,t);try{const o=this.formatPhoneNumber(e);if(!o)return console.error("Invalid phone number format"),!1;const i=await fetch(`${a.evolutionApiUrl}/message/sendText/${a.instanceName}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:a.apiKey},body:JSON.stringify({number:o,text:t})});if(!i.ok)throw new Error(`WhatsApp API error: ${i.status}`);const s=await i.json();return console.log("WhatsApp message sent via API:",s),!0}catch(o){return console.error("Failed to send WhatsApp message via API, falling back to Web:",o),this.sendMessageViaWeb(e,t)}}sendMessageViaWeb(e,t){try{const a=this.formatPhoneNumber(e);if(!a)return console.error("Invalid phone number format"),!1;const o=`https://wa.me/${a}?text=${encodeURIComponent(t)}`;return window.open(o,"_blank"),!0}catch(a){return console.error("Failed to send WhatsApp message:",a),!1}}formatPhoneNumber(e){if(!e)return null;let t=e.replace(/\D/g,"");if(t.startsWith("07")&&t.length===11)t="44"+t.substring(1);else if(!(t.startsWith("447")&&t.length===13)){if(!(t.length>=10))return null}return t}validatePhoneNumber(e){const t=this.formatPhoneNumber(e);return t!==null&&t.length>=10}isAvailable(){return typeof window<"u"&&"open"in window}async testWhatsApp(e){try{return this.validatePhoneNumber(e)?await this.sendMessage(e,`🏋️‍♂️ GymBuddy Test: Your WhatsApp notifications are working perfectly! 💪

This is a test message from your GymBuddy app. You'll receive these notifications when:
• Both users set availability
• Sessions are confirmed
• Sessions are cancelled
• Workout reminders

No more SMS costs - WhatsApp is completely FREE! 🎉`)?{success:!0}:{success:!1,error:"Failed to send WhatsApp message"}:{success:!1,error:"Invalid phone number format"}}catch(t){return{success:!1,error:t instanceof Error?t.message:"Unknown error"}}}async checkBothUsersAvailability(){try{const{data:e,error:t}=await y.from("users").select("id, name, phone_number, email").in("email",["ivanaguilarmari@gmail.com","youssef.dummy@test.com"]);if(t)throw t;if(!e||e.length!==2)return{bothSet:!1,users:[]};const a=new Date;a.setDate(a.getDate()-a.getDay()),a.setHours(0,0,0,0);const o=new Date(a);o.setDate(o.getDate()+6),o.setHours(23,59,59,999);const i=await Promise.all(e.map(async n=>{const{data:r}=await y.from("availability").select("*").eq("user_id",n.id).gte("date",a.toISOString()).lte("date",o.toISOString());return{...n,hasAvailability:r&&r.length>0}}));return{bothSet:i.every(n=>n.hasAvailability),users:i}}catch(e){return console.error("Error checking availability:",e),{bothSet:!1,users:[]}}}async findCommonAvailability(){try{const{data:e}=await y.from("users").select("id").in("email",["ivanaguilarmari@gmail.com","youssef.dummy@test.com"]);if(!e||e.length!==2)return null;const[t,a]=e.map(l=>l.id),o=new Date;o.setDate(o.getDate()-o.getDay()),o.setHours(0,0,0,0);const i=new Date(o);i.setDate(i.getDate()+6);const{data:s}=await y.from("availability").select("*").eq("user_id",t).gte("date",o.toISOString()).lte("date",i.toISOString()),{data:n}=await y.from("availability").select("*").eq("user_id",a).gte("date",o.toISOString()).lte("date",i.toISOString());if(!s||!n)return null;const r=[];for(const l of s)for(const u of n)if(l.date===u.date){const h=Math.max(l.start_time,u.start_time),g=Math.min(l.end_time,u.end_time);if(g>h){const f=g-h;f>=2&&r.push({date:new Date(l.date),startTime:h,endTime:g,duration:f})}}r.sort((l,u)=>l.date.getTime()-u.date.getTime());const d=[];let m=null;for(const l of r){if(d.length>=2)break;(!m||l.date.getTime()-m.getTime()>1440*60*1e3)&&(d.push({date:l.date,startTime:l.startTime,endTime:Math.min(l.startTime+4,l.endTime),dayName:l.date.toLocaleDateString("en-US",{weekday:"long"})}),m=l.date)}return{commonSlots:r,suggestedSessions:d}}catch(e){return console.error("Error finding common availability:",e),null}}generateAvailabilityMessage(e,t,a){const{commonSlots:o,suggestedSessions:i}=e,s=a||"your gym partner";let n=`🏋️ *GymBuddy Coordination Update*

`;return n+=`Hey ${t}! Both you and ${s} have set your availability. Here's what we found:

`,n+=`📅 *Available Time Slots:*
`,o.forEach(r=>{const d=r.date.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}),m=this.formatTime(r.startTime/2),l=this.formatTime(r.endTime/2);n+=`• ${d}: ${m} - ${l} (${r.duration}h)
`}),i.length>0?(n+=`
💡 *Suggested Sessions:*
`,i.forEach((r,d)=>{const m=r.date.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}),l=this.formatTime(r.startTime/2),u=this.formatTime(r.endTime/2);n+=`${d+1}. ${m} ${l} - ${u}
`}),n+=`
✅ *Reply to this chat using natural language to confirm or suggest changes!*
`,n+=`The AI assistant that Ivan created will help coordinate the final schedule between you and ${s}.`):(n+=`
❌ No overlapping slots found for 2+ hour sessions.
`,n+="Please adjust your availability in the GymBuddy app."),n}formatTime(e){const t=e>=12?"PM":"AM";return`${e===0?12:e>12?e-12:e}:00 ${t}`}async sendAvailabilityNotification(){try{const{bothSet:e,users:t}=await this.checkBothUsersAvailability();if(!e)return console.log("Not both users have set availability yet"),!1;const a=await this.findCommonAvailability();if(!a)return console.log("No common availability found"),!1;const o=await Promise.all(t.map(async s=>{if(!s.phone_number)return console.log(`No phone number for user ${s.name}`),!1;const n=t.find(d=>d.id!==s.id),r=this.generateAvailabilityMessage(a,s.name,n?.name);return await this.sendMessage(s.phone_number,r)})),i=this.getConfig();if(i.n8nWebhookUrl)try{await fetch(i.n8nWebhookUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger:"availability_notification_sent",users:t.map(s=>({id:s.id,name:s.name,phone:s.phone_number})),availability:a})})}catch(s){console.error("Failed to trigger n8n workflow:",s)}return o.every(s=>s)}catch(e){return console.error("Error sending availability notification:",e),!1}}async createSessionCalendarEvents(e,t){try{const{calendarService:a}=await p(async()=>{const{calendarService:r}=await import("./services-DekJxO-H.js").then(d=>d.c);return{calendarService:r}},__vite__mapDeps([0,1,2,3,4,5])),[o,i]=t,s=await Promise.all([a.createCalendarEvents(e,i.email||"partner@gymbuddy.app",i.name),a.createCalendarEvents(e,o.email||"partner@gymbuddy.app",o.name)]),n=s.some(r=>r.google||r.apple);return n&&await Promise.all(t.map(async r=>{if(r.phone_number){const d=`📅 *Calendar Event Created!*

Your gym session has been added to your calendar! 🎉

✅ Google Calendar: ${s[0].google?"Added":"Manual setup needed"}
✅ Apple Calendar: Download the .ics file to add to your calendar

⏰ Don't forget to set your alarm 30 minutes before!

_Sent from GymBuddy_`;await this.sendMessage(r.phone_number,d)}})),n}catch(a){return console.error("Error creating calendar events:",a),!1}}async sendSessionConfirmation(e,t){try{const[a,o]=t,i=await Promise.all(t.map(async(n,r)=>{if(!n.phone_number)return!1;const d=r===0?o:a,m=e.date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}),l=this.formatTime(e.startTime),u=S.SESSION_CONFIRMED(d.name,m,l);return await this.sendMessage(n.phone_number,u)})),s=await this.createSessionCalendarEvents(e,t);return console.log("Session confirmation sent:",i.every(n=>n)),console.log("Calendar events created:",s),i.every(n=>n)}catch(a){return console.error("Error sending session confirmation:",a),!1}}}const A=new b,S={AVAILABILITY_READY:c=>`🏋️‍♂️ *GymBuddy Alert*

Great news! Both you and *${c}* have set your availability! 🎉

You can now find matching workout times and schedule your sessions together.

👉 Open GymBuddy to see your options
💪 Let's get those gains!

_Sent from GymBuddy - Free WhatsApp notifications_`,SESSION_CONFIRMED:(c,e,t)=>`💪 *GymBuddy: Session Confirmed!*

Your workout is locked in! 🔥

👥 *Partner:* ${c}
📅 *Day:* ${e}
⏰ *Time:* ${t}

See you at the gym! Let's crush this workout together! 🏋️‍♂️

_Sent from GymBuddy - Free WhatsApp notifications_`,SESSION_CANCELLED:(c,e,t)=>`❌ *GymBuddy: Session Cancelled*

${c} had to cancel your workout:

📅 *Original Day:* ${e}
⏰ *Original Time:* ${t}

Don't worry - you can reschedule anytime in the app! 💪

👉 Open GymBuddy to find new times

_Sent from GymBuddy - Free WhatsApp notifications_`,SESSION_REMINDER:(c,e)=>`⏰ *GymBuddy Reminder*

Your workout starts soon! 🔥

👥 *Partner:* ${c}
⏰ *Starting in:* ${e}

Time to get pumped! 💪 Grab your gear and head to the gym!

_Sent from GymBuddy - Free WhatsApp notifications_`,PARTNER_JOINED:c=>`🎉 *GymBuddy: Your Partner Joined!*

*${c}* just created their GymBuddy account! 🙌

You can now:
✅ Set your availability
✅ Find matching workout times
✅ Schedule sessions together

👉 Open GymBuddy to get started
💪 Let's make those fitness goals happen!

_Sent from GymBuddy - Free WhatsApp notifications_`,AVAILABILITY_UPDATED:c=>`📅 *GymBuddy: Schedule Updated*

*${c}* just updated their availability! 🔄

There might be new matching workout times available.

👉 Check GymBuddy for fresh options
💪 More opportunities to train together!

_Sent from GymBuddy - Free WhatsApp notifications_`};export{S as W,A as w};
