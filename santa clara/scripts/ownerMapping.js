// ownerMapping.js — Santa Clara (CA).
//
// Требуется CLI-раннером трансформа (dist/commands/transform/script-runner.js:
// County-mode всегда запускает ownerMapping/structureMapping/layoutMapping/
// utilityMapping ПЕРЕД data_extractor.js). В FL-графствах эти модули строят
// промежуточные owners/*.json из HTML. У открытого Socrata-слоя Santa Clara
// НЕТ данных о владельцах (county Recorder отключил онлайн grantor/grantee
// index; ownership — платно/офлайн). Поэтому здесь — осознанный no-op:
// ничего не пишем, extractor не эмитит person_/company_/relationship_owner_*.
//
// Когда появится платный ассессор/рекордер-файл — здесь строить owners/owner_data.json.
console.log("ownerMapping (santa_clara): no open-data owner source; no-op");
