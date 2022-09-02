import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { expect } from 'chai';
import sinon from 'sinon';

import { MessagesComponent } from '@mm-modules/messages/messages.component';
import { ChangesService } from '@mm-services/changes.service';
import { MessageContactService } from '@mm-services/message-contact.service';
import { RelativeDatePipe } from '@mm-pipes/date.pipe';
import { SettingsService } from '@mm-services/settings.service';
import { ModalService } from '@mm-modals/mm-modal/mm-modal';
import { NavigationComponent } from '@mm-components/navigation/navigation.component';
import { TourService } from '@mm-services/tour.service';
import { NavigationService } from '@mm-services/navigation.service';
import { UserContactService } from '@mm-services/user-contact.service';
import { SessionService } from '@mm-services/session.service';

describe('Messages Component', () => {
  let component: MessagesComponent;
  let fixture: ComponentFixture<MessagesComponent>;
  let messageContactService;
  let changesService;
  let exportService;
  let modalService;
  let userContactService;
  let sessionService;

  const userContactGrandparent = { _id: 'grandparent' };
  const userContactDoc = {
    _id: 'user',
    parent: {
      _id: 'parent',
      name: 'parent',
      parent: userContactGrandparent,
    },
  };

  beforeEach(waitForAsync(() => {
    modalService = { show: sinon.stub() };
    messageContactService = {
      getList: sinon.stub().resolves([]),
      isRelevantChange: sinon.stub()
    };
    changesService = {
      subscribe: sinon.stub().resolves(of({}))
    };
    userContactService = {
      get: sinon.stub().resolves(userContactDoc),
    };
    sessionService = { isOnlineOnly : sinon.stub().returns(false) };
    const tourServiceMock = {
      startIfNeeded: () => {}
    };
    const mockedSelectors = [
      { selector: 'getSelectedConversation', value: {} },
      { selector: 'getConversations', value: 
          [
            { key: 'a', message: { inAllMessages: true },
              lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
            },
          ],
      },
      { selector: 'getLoadingContent', value: false },
      { selector: 'getMessagesError', value: false },
    ];

    return TestBed
      .configureTestingModule({
        imports: [
          TranslateModule.forRoot({ loader: { provide: TranslateLoader, useClass: TranslateFakeLoader } }),
          RouterTestingModule
        ],
        declarations: [
          MessagesComponent,
          RelativeDatePipe,
          NavigationComponent,
        ],
        providers: [
          provideMockStore({ selectors: mockedSelectors }),
          { provide: ChangesService, useValue: changesService },
          { provide: MessageContactService, useValue: messageContactService },
          { provide: SettingsService, useValue: {} }, // Needed because of ngx-translate provider's constructor.
          { provide: exportService, useValue: {} },
          { provide: ModalService, useValue: modalService },
          { provide: TourService, useValue: tourServiceMock },
          { provide: NavigationService, useValue: {} },
          { provide: UserContactService, useValue: userContactService },
          { provide: SessionService, useValue: sessionService },
        ]
      })
      .compileComponents()
      .then(() => {
        fixture = TestBed.createComponent(MessagesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      });
  }));

  afterEach(() => {
    sinon.restore();
  });

  it('should create MessagesComponent', () => {
    expect(component).to.exist;
  });

  it('ngOnInit() should update conversations and watch for changes', () => {
    const spyUpdateConversations = sinon.spy(component, 'updateConversations');
    changesService.subscribe.reset();
    const spySubscriptionsAdd = sinon.spy(component.subscriptions, 'add');

    component.ngOnInit();

    expect(spyUpdateConversations.callCount).to.equal(1);
    expect(changesService.subscribe.callCount).to.equal(1);
    expect(spySubscriptionsAdd.callCount).to.equal(2);
  });

  it('listTrackBy() should return unique identifier', () => {
    const messageWithDoc = { key: '134', id: 'abc', doc: { _rev: '567', id: 'xyz' } };
    const messageNoDoc = { key: '134', id: 'abc' };

    const resultWithDoc = component.listTrackBy(0, messageWithDoc);
    const resultNoDoc = component.listTrackBy(0, messageNoDoc);

    expect(resultWithDoc).to.equal('134xyz567');
    expect(resultNoDoc).to.equal('134abc');
  });

  describe('updateConversations()', () => {
    it('should get conversations and add new one', async () => {
      const newConversations = [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'c', message: { inAllMessages: true } },
        { key: 'b', message: { fromUpdatedMessages: true } }
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(newConversations);
      component.conversations = [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'c', message: { inAllMessages: true } }
      ];
      fixture.detectChanges();

      await component.updateConversations({ merge: true });

      expect(messageContactService.getList.callCount).to.equal(1);
      expect(component.loading).to.be.false;
      expect(component.conversations.length).to.equal(3);
      expect(component.conversations).to.eql(newConversations);
    });

    it('should get conversations and replace updated ones', async () => {
      const newConversations = [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'b', message: { fromUpdatedMessages: true } }
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(newConversations);
      const expectedConversations =  [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'b', message: { fromUpdatedMessages: true }, read: false }
      ];
      component.conversations = [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'b', message: { inAllMessages: true }, read: true }
      ];
      fixture.detectChanges();

      await component.updateConversations({ merge: true });

      expect(messageContactService.getList.callCount).to.equal(1);
      expect(component.loading).to.be.false;
      expect(component.conversations).to.eql( expectedConversations);
    });

    it('should get conversations and remove conversations that no longer exist', async () => {
      const newConversations = [
        { key: 'a', message: { updatedMessage: true }, read: false },
        { key: 'b', message: { updatedMessage: true }, read: false }
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(newConversations);
      component.conversations = [
        { key: 'a', message: { inAllMessages: true } },
        { key: 'b', message: { inAllMessages: true } },
        { key: 'c', message: { inAllMessages: true } },
        { key: 'd', message: { inAllMessages: true } },
      ];
      fixture.detectChanges();

      await component.updateConversations({ merge: true });

      expect(messageContactService.getList.callCount).to.equal(1);
      expect(component.loading).to.be.false;
      expect(component.conversations).to.eql( newConversations);
    });

    it('it should retrieve the hierarchy level of the connected user', () => {
      //userContactService.get.resolves(userContactDoc);
      sessionService.isOnlineOnly.returns(false);
      component.ngOnInit();
      expect(component.currentLevel).to.equal('parent');
    });

    it('it should not change the conversations lineage if the connected user is online only', async () => {
      const conversations = [
        { key: 'a', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'b', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'c', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'd', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(conversations);
      userContactService.get.resolves(userContactDoc);
      sessionService.isOnlineOnly.returns(true);
      await component.updateConversations({merge : true});
      expect(messageContactService.getList.callCount).to.equal(1);
      expect(component.currentLevel).to.equal('parent');
      expect(component.conversations).to.deep.equal(conversations);
    });

    it('it should not change the conversations lineage ' +
      'if the connected user is offline only but belongs to a place out of the conversation lineage', async () => {
      const offlineUserContactDoc = {
        _id: 'user',
        parent: {
          _id: 'parent',
          name: 'parent',
          parent: userContactGrandparent,
        },
      };
      const conversations = [
        { key: 'a', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'b', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'c', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'd', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(conversations);
      userContactService.get.resolves(offlineUserContactDoc);
      sessionService.isOnlineOnly.returns(false);
      //fixture.detectChanges();
      await component.updateConversations({merge : true});
      expect(await messageContactService.getList.callCount).to.equal(1);
      expect(component.currentLevel).to.equal('parent');
      expect(component.conversations).to.equal(conversations);
    });

    it('it should update the conversations lineage ' +
      'if the connected user is offline and belongs to a place of the conversation lineage', fakeAsync( () => {
      const offlineUserContactDoc2 = {
        _id: 'user',
        parent: {
          _id: 'parent',
          name: 'CHW Bettys Area',
          parent: userContactGrandparent,
        },
      };
      const conversations = [
        { key: 'a', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'b', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'c', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
        { key: 'd', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village', 'CHW Bettys Area']
        },
      ];
      const updatedConversations = [
        { key: 'a', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village']
        },
        { key: 'b', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village']
        },
        { key: 'c', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village']
        },
        { key: 'd', message: { inAllMessages: true },
          lineage : [ 'Amy Johnsons Household', 'St Elmos Concession', 'Chattanooga Village']
        },
      ];
      messageContactService.getList.reset();
      messageContactService.getList.resolves(conversations);
      userContactService.get.resolves(offlineUserContactDoc2);
      sessionService.isOnlineOnly.returns(false);
      component.ngOnInit();
      tick();
      component.updateConversations({merge : true});
      tick();
      expect(messageContactService.getList.callCount).to.equal(2);
      expect(component.currentLevel).to.equal('CHW Bettys Area');
      expect(component.conversations).to.deep.equal(updatedConversations);
    }));
  });

  it('ngOnDestroy() should unsubscribe from observables', () => {
    const spySubscriptionsUnsubscribe = sinon.spy(component.subscriptions, 'unsubscribe');

    component.ngOnDestroy();

    expect(spySubscriptionsUnsubscribe.callCount).to.equal(1);
  });

});
