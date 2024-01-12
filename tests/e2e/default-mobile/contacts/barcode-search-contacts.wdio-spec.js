const searchPage = require('@page-objects/default-mobile/search/search.wdio.page.js');
const loginPage = require('@page-objects/default/login/login.wdio.page');
const utils = require('@utils');
const contactPage = require('@page-objects/default/contacts/contacts.wdio.page');
const commonPage = require('@page-objects/default/common/common.wdio.page');
const placeFactory = require('@factories/cht/contacts/place');
const personFactory = require('@factories/cht/contacts/person');
const userFactory = require('@factories/cht/users/users');
const path = require('path');

const places = placeFactory.generateHierarchy();
const healthCenter = places.get('health_center');
const offlineUser = userFactory.build({ place: healthCenter._id, roles: ['chw'] });
const person = personFactory.build({
  patient_id: '123456',
  parent: { _id: healthCenter._id, parent: healthCenter.parent }
});
const barcodeImagePath = path.join(__dirname, '/images/valid-barcode.jpg');
const invalidBarcodeImagePath = path.join(__dirname, '/images/invalid-barcode.jpg');

describe('Test Contact Search with Barcode Scanner', async () => {
  before(async () => {
    await utils.saveDocs([...places.values(), person]);
    await utils.createUsers([offlineUser]);
    const canUseBarcodeScannerPermission = ['can_use_barcode_scanner'];
    await utils.updatePermissions(offlineUser.roles, canUseBarcodeScannerPermission, [], false);
    await loginPage.login(offlineUser);
    await commonPage.waitForPageLoaded();
  });

  it('Search should display correct results, clear search should display all contacts', async () => {
    await commonPage.goToPeople();
    await browser.refresh();
    await searchPage.performBarcodeSearch(barcodeImagePath);
    expect(await contactPage.getAllLHSContactsNames()).to.have.members([
      person.name
    ]);

    await searchPage.searchPageDefault.clearSearch();
    expect(await contactPage.getAllLHSContactsNames()).to.have.members([
      healthCenter.name,
      places.get('clinic').name
    ]);
  });

  it('With an invalid barcode image - Search should display snackbar with error message', async () => {
    await commonPage.goToPeople();
    await searchPage.performBarcodeSearch(invalidBarcodeImagePath);
    await commonPage.waitForLoaders();
    expect(await commonPage.snackbarMessage()).to.equal('Failed to read the barcode. Retry.');
  });

});
