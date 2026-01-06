// landregistry.js - Smart Contract (Chaincode) for Land Registry
'use strict';

const { Contract } = require('fabric-contract-api');

class LandRegistryContract extends Contract {

  // Initialize ledger with sample data
  async InitLedger(ctx) {
    const lands = [
      {
        propertyId: 'PROP-001',
        owner: 'Ravi Kumar',
        surveyNo: '123/A',
        district: 'Medchal',
        mandal: 'Ghatkesar',
        village: 'Edulabad',
        area: '2.5 Acres',
        landType: 'Agricultural',
        marketValue: '₹ 45,00,000',
        ipfsCID: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        lastUpdated: new Date().toISOString()
      },
      {
        propertyId: 'PROP-987654',
        owner: 'Lakshmi Reddy',
        surveyNo: '321/D',
        district: 'Medchal',
        mandal: 'Shamirpet',
        village: 'Turkapally',
        area: '3.2 Acres',
        landType: 'Commercial',
        marketValue: '₹ 1,50,00,000',
        ipfsCID: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        lastUpdated: new Date().toISOString()
      }
    ];

    for (const land of lands) {
      await ctx.stub.putState(land.propertyId, Buffer.from(JSON.stringify(land)));
      console.log(`Land ${land.propertyId} initialized`);
    }

    return 'Ledger initialized successfully';
  }

  // Create a new land record
  async CreateLandRecord(ctx, propertyId, owner, surveyNo, district, mandal, 
                         village, area, landType, marketValue, ipfsCID) {
    
    // Check if property already exists
    const exists = await this.LandRecordExists(ctx, propertyId);
    if (exists) {
      throw new Error(`Land record ${propertyId} already exists`);
    }

    const land = {
      propertyId,
      owner,
      surveyNo,
      district,
      mandal,
      village,
      area,
      landType,
      marketValue,
      ipfsCID,
      lastUpdated: new Date().toISOString()
    };

    await ctx.stub.putState(propertyId, Buffer.from(JSON.stringify(land)));
    
    // Emit event
    ctx.stub.setEvent('LandRecordCreated', Buffer.from(JSON.stringify(land)));
    
    return JSON.stringify(land);
  }

  // Read land record by property ID
  async ReadLandRecord(ctx, propertyId) {
    const landJSON = await ctx.stub.getState(propertyId);
    if (!landJSON || landJSON.length === 0) {
      throw new Error(`Land record ${propertyId} does not exist`);
    }
    return landJSON.toString();
  }

  // Query land by survey number
  async QueryLandBySurvey(ctx, district, mandal, village, surveyNo) {
    const queryString = {
      selector: {
        district,
        mandal,
        village,
        surveyNo
      }
    };

    const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
    const results = await this._getAllResults(iterator);

    if (results.length === 0) {
      throw new Error('No land record found for the given survey details');
    }

    return JSON.stringify(results[0]);
  }

  // Update land record
  async UpdateLandRecord(ctx, propertyId, newOwner, newMarketValue) {
    const exists = await this.LandRecordExists(ctx, propertyId);
    if (!exists) {
      throw new Error(`Land record ${propertyId} does not exist`);
    }

    const landJSON = await ctx.stub.getState(propertyId);
    const land = JSON.parse(landJSON.toString());

    land.owner = newOwner;
    land.marketValue = newMarketValue;
    land.lastUpdated = new Date().toISOString();

    await ctx.stub.putState(propertyId, Buffer.from(JSON.stringify(land)));
    
    // Emit event
    ctx.stub.setEvent('LandRecordUpdated', Buffer.from(JSON.stringify(land)));
    
    return JSON.stringify(land);
  }

  // Delete land record
  async DeleteLandRecord(ctx, propertyId) {
    const exists = await this.LandRecordExists(ctx, propertyId);
    if (!exists) {
      throw new Error(`Land record ${propertyId} does not exist`);
    }

    await ctx.stub.deleteState(propertyId);
    
    // Emit event
    ctx.stub.setEvent('LandRecordDeleted', Buffer.from(propertyId));
    
    return `Land record ${propertyId} deleted successfully`;
  }

  // Check if land record exists
  async LandRecordExists(ctx, propertyId) {
    const landJSON = await ctx.stub.getState(propertyId);
    return landJSON && landJSON.length > 0;
  }

  // Get all land records
  async GetAllLandRecords(ctx) {
    const iterator = await ctx.stub.getStateByRange('', '');
    const allResults = await this._getAllResults(iterator);
    return JSON.stringify(allResults);
  }

  // Get land history
  async GetLandHistory(ctx, propertyId) {
    const iterator = await ctx.stub.getHistoryForKey(propertyId);
    const history = [];

    while (true) {
      const res = await iterator.next();

      if (res.value && res.value.value.toString()) {
        const record = {
          txId: res.value.txId,
          timestamp: res.value.timestamp,
          isDelete: res.value.isDelete,
          value: JSON.parse(res.value.value.toString())
        };
        history.push(record);
      }

      if (res.done) {
        await iterator.close();
        break;
      }
    }

    return JSON.stringify(history);
  }

  // Query lands by owner
  async QueryLandsByOwner(ctx, owner) {
    const queryString = {
      selector: {
        owner
      }
    };

    const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
    const results = await this._getAllResults(iterator);
    return JSON.stringify(results);
  }

  // Query lands by district
  async QueryLandsByDistrict(ctx, district) {
    const queryString = {
      selector: {
        district
      }
    };

    const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
    const results = await this._getAllResults(iterator);
    return JSON.stringify(results);
  }

  // Helper function to get all results from iterator
  async _getAllResults(iterator) {
    const allResults = [];

    while (true) {
      const res = await iterator.next();

      if (res.value && res.value.value.toString()) {
        const record = JSON.parse(res.value.value.toString());
        allResults.push(record);
      }

      if (res.done) {
        await iterator.close();
        break;
      }
    }

    return allResults;
  }
}

module.exports = LandRegistryContract;