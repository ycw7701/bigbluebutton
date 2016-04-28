import { clearCollections } from '/server/helpers';
import { WhiteboardCleanStatus } from '/collections/collections';

const indexOf = [].indexOf || function (item) {
  for (let i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1;
};


const log = {};
if (process != null && process.env != null && process.env.NODE_ENV == 'production') {
  log.path = '/var/log/bigbluebutton/bbbnode.log';
} else {
  log.path = `${process.env.PWD}/log/development.log`;
}

// Setting up a logger in Meteor.log
export let logger = new Winston.Logger({
  transports: [
    new Winston.transports.Console(), new Winston.transports.File({
      filename: log.path,
    }),
  ],
});

Meteor.startup(() => {
  logger.info('server start');
  
  //remove all data
  WhiteboardCleanStatus.remove({});
  clearCollections();

  const eventEmitter = new (Npm.require('events').EventEmitter);
  registerHandlers(eventEmitter);

  const handledMessageTypes = [
    'get_users_reply',
    'meeting_created_message',
    'get_all_meetings_reply',
    'user_left_voice_message',
    'user_joined_voice_message',
    'user_voice_talking_message',
    'user_voice_muted_message',
    'user_listening_only',
    'user_left_message',
    'validate_auth_token_reply',
    'user_joined_message',
    'presenter_assigned_message',
    'user_emoji_status_message',
    'user_locked_message',
    'user_unlocked_message',
    'meeting_ended_message',
    'meeting_destroyed_event',
    'end_and_kick_all_message',
    'disconnect_all_users_message',
    'get_chat_history_reply',
    'send_public_chat_message',
    'send_private_chat_message',
    'presentation_shared_message',
    'get_presentation_info_reply',
    'presentation_page_changed_message',
    'presentation_removed_message',
    'get_whiteboard_shapes_reply',
    'send_whiteboard_shape_message',
    'presentation_cursor_updated_message',
    'whiteboard_cleared_message',
    'undo_whiteboard_request',
    'user_eject_from_meeting',
    'disconnect_user_message',
    'presentation_page_resized_message',
    'recording_status_changed_message',
    'new_permission_settings',
    'poll_show_result_message',
    'poll_started_message',
    'poll_stopped_message',
    'user_voted_poll_message',
  ];

  // create create a PubSub connection, start listening
  Meteor.redisPubSub = new Meteor.RedisPubSub(function () {
    return logger.info('created pubsub');
  });

  Meteor.myQueue = new PowerQueue({
    // autoStart:true
    // isPaused: true
  });

  Meteor.myQueue.taskHandler = function (data, next, failures) {
    let eventName, parsedMsg, length, lengthString;
    parsedMsg = JSON.parse(data.jsonMsg);

    if (parsedMsg != null) {
      eventName = parsedMsg.header.name;
      length = Meteor.myQueue.length();
      lengthString = function () {
            if (length > 0) {
              return `In the queue we have ${length} event(s) to process.`;
            } else return "";
          }() || "";
      logger.info(`in callback after handleRedisMessage ${eventName}. ${lengthString}`);
    }
    console.log("in taskHandler:" + eventName);

    if (failures > 0) {
      next();
      return logger.error(`got a failure on taskHandler ${eventName} ${failures}`);
      // TODO should we stop or instead return next?
    } else {
      logRedisMessage(eventName, data.jsonMsg);

      // note!! we first check if we handle the event type. The handled event types are listed in an array
      // if NOT in the array, call arg.callback()
      if (handledMessageTypes.indexOf(eventName) > -1) {
        return eventEmitter.emit(eventName, {
          payload: parsedMsg.payload,
          header: parsedMsg.header,

          callback: () => {
            console.log("ready for next message");
            return next();
          },
        });
      } else {
        logger.error("NOT HANDLING:" + eventName);
        return next();
      }

    }
  };

  const logRedisMessage = function (eventName, json) {
    // Avoid cluttering the log with json messages carrying little or repetitive
    // information. Comment out a message type in the array to be able to see it
    // in the log upon restarting of the Meteor process.
    notLoggedEventTypes = [
      'keep_alive_reply',
      'page_resized_message',
      'presentation_page_resized_message',
      'presentation_cursor_updated_message',
      'get_presentation_info_reply',

      //"get_users_reply"
      'get_chat_history_reply',

      //"get_all_meetings_reply"
      'get_whiteboard_shapes_reply',
      'presentation_shared_message',
      'presentation_conversion_done_message',
      'presentation_conversion_progress_message',
      'presentation_page_generated_message',

      //"presentation_page_changed_message"
      'BbbPubSubPongMessage',
      'bbb_apps_is_alive_message',
      'user_voice_talking_message',
      'meeting_state_message',
      'get_recording_status_reply',];

    // LOG in the meteor console
    if (eventName, indexOf.call(notLoggedEventTypes, eventName) < 0) {

      // For DEVELOPMENT purposes only
      // Dynamic shapes' updates will slow down significantly
      if(Meteor.settings.public.mode == 'development') {
        logger.info(`redis incoming message  ${eventName}  `, {
          message: json,
        });
      }
    }
  };

});
