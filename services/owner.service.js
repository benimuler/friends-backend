'use strict';

const DbMixin = require('../mixins/db.mixin');
const OwnerRequest = require('../models/owner/OwnerRequest');
const { validations } = require('../validation');

/**
 * owner service
 */
module.exports = {
  name: 'owner',

  /**
   * Service settings
   */
  settings: {},

  /**
   * Mixins
   */
  mixins: [DbMixin('ownerRequests')],

  /**
   * Service metadata
   */
  metadata: {},

  /**
   * Service dependencies
   */
  dependencies: [],

  /**
   * Actions
   */
  actions: {
    /**
     * Owner request action.
     *
     * @returns
     */
    request: {
      rest: {
        method: 'POST',
        path: '/request',
      },
      body: OwnerRequest,
      async handler(ctx) {
        ctx.body ?? (ctx.body = ctx.params);
        validations.isRequesterAndCreatorTheSame(
          ctx.meta.user.id,
          ctx.body.approver
        );

        const request = ctx.body;
        request.createdAt = new Date();
        request.status = 'Pending';
        try {
          const res = await this.adapter.insert(ctx.body);
          ctx.emit('mail.owner', request);
          return res;
        } catch (err) {
          console.error(err);
          throw new Error('Failed to owner a request');
        }
      },
    },

    /**
     * Approve request action.
     *
     * @returns
     */
    approve: {
      rest: {
        method: 'PUT',
        path: '/request/approve/:id',
      },
      async handler(ctx) {
        try {
          const ownerRequest = await this.adapter.updateById(ctx.params.id, {
            $set: {
              status: 'Approved',
            },
          });

          return await this.broker.call('ad.updateGroupOwner', {
            groupId: ownerRequest?.groupId,
            owner: ownerRequest?.creator,
          });
        } catch (err) {
          console.error(err);
          throw new Error('Failed to approve a request');
        }
      },
    },

    /**
     * Deny request action.
     *
     * @returns
     */
    deny: {
      rest: {
        method: 'PUT',
        path: '/request/deny/:id',
      },
      async handler(ctx) {
        try {
          return await this.adapter.updateById(ctx.params.id, {
            $set: {
              status: 'Denied',
            },
          });
        } catch (err) {
          console.error(err);
          throw new Error('Failed to deny a request');
        }
      },
    },

    /**
     * Get requests by creator action.
     *
     * @returns
     */
    requestsByCreator: {
      rest: {
        method: 'GET',
        path: '/requests/creator',
      },
      async handler(ctx) {
        console.log(ctx.meta.user.id, 'userID');
        console.log(ctx.meta.user, 'user');
        console.log(ctx.meta, 'meta');
        try {
          console.log(ctx.meta.user.id, 'userID');
          const res = await this.adapter.find({
            query: { creator: ctx.meta.user.id },
          });
          console.log(res, 'response');
          return { requests: res };
        } catch (err) {
          console.error(err, 'error');
          throw new Error("Failed to get creator's requests");
        }
      },
    },

    /**
     * Get requests by approver action.
     *
     * @returns
     */
    requestsByApprover: {
      rest: {
        method: 'GET',
        path: '/requests/approver',
      },
      async handler(ctx) {
        try {
          const res = await this.adapter.find({
            query: {
              approver: ctx.meta.user.id,
              status: 'Pending',
            },
          });

          return { requests: res };
        } catch (err) {
          console.error(err);
          throw new Error("Failed to get approver's requests");
        }
      },
    },
  },

  /**
   * Events
   */
  events: {},

  /**
   * Methods
   */
  methods: {},

  /**
   * Service created lifecycle event handler
   */
  created() {},

  /**
   * Service started lifecycle event handler
   */
  async started() {},

  /**
   * Service stopped lifecycle event handler
   */
  async stopped() {},

  /**
   * Fired after database connection establishing.
   */
  async afterConnected() {
    if (!!this.adapter.collection) {
      await this.adapter.collection.createIndex({
        creator: 1,
        approver: 1,
        groupId: 1,
      });
    }
  },
};
