/** HVA CUOC HOP AI — MODULE RIENG. Khong can thiep nhan su, QR, phat hanh. */
const HVA_MEETING_AI_V1 = {
  generate: function(payload, identity) {
    payload=payload||{};
    const prompt=String(payload.prompt||'').trim();
    if(!prompt||prompt.length>3000)return {success:false,message:'Yêu cầu phải có nội dung và không quá 3.000 ký tự.'};
    const props=PropertiesService.getScriptProperties();
    const apiKey=String(props.getProperty('OPENAI_API_KEY')||'').trim();
    const model=String(props.getProperty('OPENAI_MEETING_MODEL')||'gpt-4.1-mini').trim();
    if(!apiKey)return {success:false,message:'Chưa cấu hình OPENAI_API_KEY trong Script Properties.'};
    const now=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh',"yyyy-MM-dd'T'HH:mm:ss");
    const instructions=[
      'Bạn là trợ lý soạn dự thảo cuộc họp của Trường THPT Hòa Vang, Việt Nam.',
      'Hôm nay theo giờ Việt Nam: '+now+'. Múi giờ Asia/Ho_Chi_Minh.',
      'Từ yêu cầu của người dùng, trích xuất thông tin và soạn nội dung chương trình họp ngắn gọn, hành chính, không bịa chi tiết.',
      'Nếu thiếu ngày, giờ, địa điểm, người chủ trì, thư ký: để chuỗi rỗng và nêu cảnh báo.',
      'Ngày định dạng YYYY-MM-DD, giờ HH:mm 24 giờ. Nếu có thời lượng và giờ bắt đầu, tính giờ kết thúc cùng ngày.',
      'meetingMode chỉ là ONLINE, OFFLINE hoặc chuỗi rỗng. Không tạo hay bịa link Google Meet.',
      'attendeeSuggestion là mô tả nhóm/người được yêu cầu, KHÔNG tự tạo username, KHÔNG khẳng định đã chọn nhân sự.',
      'Chỉ đưa thông tin từ yêu cầu, không suy đoán quyền phát hành hoặc tự phát hành.',
      'Trả về đúng JSON theo schema.'
    ].join('\n');
    const fields=['title','content','note','date','startTime','endTime','meetingMode','place','chairperson','secretary','attendeeSuggestion'];
    const properties={};fields.forEach(function(k){properties[k]={type:'string'};});
    properties.warnings={type:'array',items:{type:'string'}};
    const request={
      model:model,
      store:false,
      instructions:instructions,
      input:[{role:'user',content:[{type:'input_text',text:prompt}]}],
      text:{format:{type:'json_schema',name:'hva_meeting_draft',strict:true,schema:{type:'object',additionalProperties:false,properties:properties,required:fields.concat(['warnings'])}}},
      max_output_tokens:1400
    };
    try{
      const res=UrlFetchApp.fetch('https://api.openai.com/v1/responses',{
        method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+apiKey},
        payload:JSON.stringify(request),muteHttpExceptions:true
      });
      const status=res.getResponseCode();
      if(status<200||status>=300){
        console.error('HVA_MEETING_AI_HTTP '+status);
        return {success:false,message:'Dịch vụ AI chưa phản hồi thành công (HTTP '+status+'). Kiểm tra API key, model và hạn mức.'};
      }
      const data=JSON.parse(res.getContentText());
      let raw=String(data.output_text||'');
      if(!raw)(data.output||[]).forEach(function(o){(o.content||[]).forEach(function(c){if(c.type==='output_text')raw+=String(c.text||'');});});
      if(!raw)return {success:false,message:'AI chưa trả về nội dung dự thảo.'};
      const draft=JSON.parse(raw);
      if(!draft||typeof draft!=='object'||Array.isArray(draft))throw Error('INVALID_DRAFT');
      return {success:true,draft:draft};
    }catch(e){
      console.error('HVA_MEETING_AI_ERROR '+String(e));
      return {success:false,message:'Lỗi kết nối hoặc định dạng phản hồi AI. Vui lòng thử lại.'};
    }
  }
};

/** TEST doc lap: khong goi API, khong ghi du lieu */
function TEST_HVA_MEETING_AI_NO_INPUT(){
  const r=HVA_MEETING_AI_V1.generate({prompt:''},{username:'test'});
  if(r.success!==false)throw Error('EMPTY_INPUT_NOT_BLOCKED');
  return {success:true,test:'EMPTY_INPUT_BLOCKED'};
}
