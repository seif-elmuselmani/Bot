/**
 * Services Configuration Map
 * Defines all standard and design service types, prices, and Arabic labels.
 */

const servicesConfig = {
  'similarity_report': { type: 'similarity_report', price: 45, name: 'تقرير التشابه العلمي (Similarity)' },
  'similarity_exclude': { type: 'similarity_exclude_report', price: 45, name: 'تقرير التشابه + استبعاد المراجع' },
  'ai_writing': { type: 'ai_writing_report', price: 80, name: 'تقرير فحص الذكاء الاصطناعي (AI)' },
  'both_reports': { type: 'both_reports', price: 90, name: 'كلا التقريرين (تشابه + AI)' },
  'design_create_cv': { type: 'cv_design', price: 150, name: 'إنشاء سيرة ذاتية ATS (من سيرة قديمة)' },
  'design_edit_cv': { type: 'cv_design', price: 50, name: 'تعديل/تحديث سيرة ذاتية ATS' },
  'design_create_portfolio': { type: 'portfolio_design', price: 300, name: 'إنشاء بورتفوليو (من سيرة ATS)' },
  'design_edit_portfolio': { type: 'portfolio_design', price: 100, name: 'تعديل/تحديث بورتفوليو' },
  'ai_reduction': { type: 'ai_reduction', price: 0, name: 'تقليل نسبة الذكاء الاصطناعي' }
};

module.exports = servicesConfig;
