import{j as s}from"./ui-vendor-CRP0iqJy.js";import{r as u}from"./react-vendor-DWv6uwxK.js";import{B as b,s as a}from"./auth-BNfNio64.js";import"./utils-vendor-BZaDkFqu.js";import"./supabase-vendor-B9YYga7y.js";function S(){const[i,n]=u.useState(""),[o,l]=u.useState(!1),f=async()=>{l(!0);let e=`👥 Creating Youssef Test User...

`;try{const t={id:"331ac976-78f4-4167-8d33-cedf356d2e61",email:"youssef.dummy@test.com",name:"Youssef",phone_number:null,preferences:{notifications:{sms:!0,push:!0,reminder_time:30}},stats:{total_sessions:0,current_streak:0,badges:[]}};e+=`📝 Step 1: Creating Youssef user profile...
`;const{error:d}=await a.from("users").insert([t]).select();d?(e+=`⚠️  User insert failed (expected): ${d.message}
`,e+=`This is normal - we need admin privileges to create users

`):e+=`✅ User created successfully!

`,e+=`📅 Step 2: Adding Youssef availability...
`;const p=[{user_id:"331ac976-78f4-4167-8d33-cedf356d2e61",day:"monday",start_time:22,end_time:30},{user_id:"331ac976-78f4-4167-8d33-cedf356d2e61",day:"wednesday",start_time:30,end_time:38},{user_id:"331ac976-78f4-4167-8d33-cedf356d2e61",day:"saturday",start_time:16,end_time:24}],{data:h,error:c}=await a.from("availability").insert(p).select();c?e+=`❌ Availability insert failed: ${c.message}

`:e+=`✅ Added ${h.length} availability slots for Youssef

`,e+=`🔍 Step 3: Checking results...
`;const{data:r}=await a.from("users").select("email, name").in("email",["ivanaguilarmari@gmail.com","youssef.dummy@test.com"]);e+=`Users now visible: ${r?.length||0}
`,r?.forEach(m=>{e+=`  - ${m.name} (${m.email})
`});const{data:y}=await a.from("availability").select("user_id, day").in("user_id",["f8939d4a-c2d3-4c7b-80e2-3a384fc953bd","331ac976-78f4-4167-8d33-cedf356d2e61"]);e+=`
Availability slots: ${y?.length||0}
`,r?.length===2?(e+=`
🎉 SUCCESS! Both users are now visible.
`,e+=`You can now run the WhatsApp test at /test-whatsapp
`):(e+=`
⚠️  Still missing Youssef user. Need to use SQL method.
`,e+=`Run the SQL from create-youssef-user.sql in Supabase
`),n(e)}catch(t){n(`💥 Error: ${t}`)}finally{l(!1)}};return s.jsx("div",{className:"min-h-screen bg-background p-6",children:s.jsxs("div",{className:"max-w-4xl mx-auto",children:[s.jsx("h1",{className:"text-2xl font-bold mb-6",children:"Create Test User"}),s.jsx("div",{className:"mb-6",children:s.jsx(b,{onClick:f,disabled:o,className:"mb-4",children:o?"Creating Youssef...":"Create Youssef Test User"})}),i&&s.jsx("div",{className:"bg-black text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96",children:i})]})})}export{S as CreateTestUser};
