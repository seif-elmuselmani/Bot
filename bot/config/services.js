/**
 * Services Configuration Map
 * Defines all standard and design service types, prices, and Arabic labels.
 */

const servicesConfig = {
  'similarity_60': { type: 'similarity_report', price: 60, name: 'تقرير فحص التشابه العلمي' },
  'ai_50': { type: 'ai_writing_report', price: 50, name: 'تقرير فحص الكتابة بالذكاء الاصطناعي' },
  'design_create_cv': { type: 'cv_design', price: 150, name: 'إنشاء سيرة ذاتية ATS (من سيرة قديمة)' },
  'design_edit_cv': { type: 'cv_design', price: 50, name: 'تعديل/تحديث سيرة ذاتية ATS' },
  'design_create_portfolio': { type: 'portfolio_design', price: 300, name: 'إنشاء بورتفوليو (من سيرة ATS)' },
  'design_edit_portfolio': { type: 'portfolio_design', price: 100, name: 'تعديل/تحديث بورتفوليو' }
};

module.exports = servicesConfig;
