// ==============================================================
// แก้ข้อมูลตรงนี้เป็นของจริงของคุณ แล้วบันทึกไฟล์ — หน้าเว็บจะอัปเดตป้าย
// ข้อมูลในฉาก (ป้ายตั้งโต๊ะ) ให้เองอัตโนมัติ ไม่ต้องแก้ไฟล์อื่น
// ==============================================================
export const PROFILE = {
  name: 'Apichai Kraiplong',
  studentId: '6721651904',
  major: 'Computer Science',
  faculty: 'Faculty of Liberal Arts and Sciences',
  university: 'Kasetsart University Kamphaeng Saen Campus',

  // วางไฟล์รูปสี่เหลี่ยมจัตุรัส (แนะนำ) นามสกุล .jpg หรือ .png ของตัวเอง
  // ไว้ที่ src/assets/profile.jpg (สร้างโฟลเดอร์ assets เอง) แล้วรีเฟรชหน้าเว็บ
  photo: './assets/fluke.png',
};

// รายการทักษะที่จะแสดงบนป้าย Skill ในฉาก แก้/เพิ่ม/ลบได้ตามจริง
export const SKILLS = ['C', 'Java', 'Python', 'Data Science', 'Machine Learning'];

// ข้อความบนป้ายที่ผนัง (แก้ตรงนี้ที่เดียว ป้ายจะย่อตัวอักษรให้พอดีกรอบเอง)
export const WELCOME_TEXT = '1990 BAR WELCOME';
