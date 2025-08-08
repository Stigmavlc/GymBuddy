import{j as o}from"./ui-vendor-Dh6LInB3.js";import{r as d}from"./react-vendor-DWv6uwxK.js";import{B as g}from"./auth-DZ3nYzx0.js";import{w as a}from"./whatsappService-CyAvy3J2.js";import"./utils-vendor-BZaDkFqu.js";import"./supabase-vendor-Dgy_jg73.js";function x(){const[h,i]=d.useState(""),[p,c]=d.useState(!1),u=async()=>{c(!0),i(`🧪 Testing WhatsApp Logic (Option B) - No actual messages sent

`);try{const s=await a.checkBothUsersAvailability();let e=`📋 Step 1: Checking if both users have availability...
`;if(e+=`✅ Both set: ${s.bothSet}
`,e+=`📊 Users found: ${s.users.length}

`,s.users.forEach(t=>{e+=`  - ${t.name} (${t.email}): ${t.hasAvailability?"✅":"❌"} availability, Phone: ${t.phone_number||"Not set"}
`}),!s.bothSet){e+=`
❌ Test stopped: Not both users have availability
`,i(e),c(!1);return}e+=`
🔍 Step 2: Finding common availability...
`;const n=await a.findCommonAvailability();if(!n){e+=`❌ No common availability found
`,i(e),c(!1);return}e+=`✅ Common slots found: ${n.commonSlots.length}
`,e+=`💡 Suggested sessions: ${n.suggestedSessions.length}

`,n.commonSlots.forEach(t=>{const m=new Date(t.date).toLocaleDateString("en-US",{weekday:"long"}),r=a.formatTime(t.startTime/2),l=a.formatTime(t.endTime/2);e+=`  - ${m}: ${r} - ${l} (${t.duration}h)
`}),e+=`
💡 Suggested sessions:
`,n.suggestedSessions.forEach((t,m)=>{const r=a.formatTime(t.startTime/2),l=a.formatTime(t.endTime/2);e+=`  ${m+1}. ${t.dayName}: ${r} - ${l}
`}),e+=`
📱 Step 3: WhatsApp messages that would be sent:

`,s.users.forEach(t=>{if(t.phone_number){const m=s.users.find(l=>l.id!==t.id);e+=`📨 Message for ${t.name} (${t.phone_number}):
`,e+="━".repeat(60)+`
`;const r=a.generateAvailabilityMessage(n,t.name,m?.name);e+=r+`
`,e+="━".repeat(60)+`

`}else e+=`📨 ${t.name}: No phone number set (test account)

`}),e+=`🎉 Test completed successfully!
`,e+=`✅ The WhatsApp notification system is working correctly
`,e+=`📱 For live testing, deploy the Heroku Evolution API app
`,i(e)}catch(s){i(`💥 Test failed: ${s}`)}finally{c(!1)}};return o.jsx("div",{className:"min-h-screen bg-background p-6",children:o.jsxs("div",{className:"max-w-4xl mx-auto",children:[o.jsx("h1",{className:"text-2xl font-bold mb-6",children:"WhatsApp Logic Test"}),o.jsx("div",{className:"mb-6",children:o.jsx(g,{onClick:u,disabled:p,className:"mb-4",children:p?"Testing...":"Run WhatsApp Logic Test"})}),h&&o.jsx("div",{className:"bg-black text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96",children:h})]})})}export{x as TestWhatsApp};
