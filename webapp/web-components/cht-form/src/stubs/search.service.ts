import { Injectable } from '@angular/core';
import { AppModule } from '../app.module';
// import { DbService as BaseDbService } from '../../../../src/ts/services/db.service';

@Injectable({
  providedIn: AppModule
})
export class SearchService {
  // private isOnlineOnly;
  // private cache;
  // private POUCHDB_METHODS;
  // private outOfZonePromise;
  // private outOfZoneEventEmitter;
  // private outOfZoneReplicate;
  // private sessionService;
  // private  locationService;
  // private  ngZone;
  // private getUsername;
  // private getDbName;
  // private getParams;
  // private wrapMethods;
  search(type, filters, options:any = {}, extensions:any = {}, docIds: any[] | undefined = undefined): any {
    throw new Error('Method not implemented.');
  }
}
