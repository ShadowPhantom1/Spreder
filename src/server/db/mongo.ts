import mongoose from 'mongoose'

export const UserSchema = new mongoose.Schema({_id:String, username:String, password_hash:String, role:String, is_super:Number, is_active:Number, allowed_ip:String, allowed_device:String, per_sim_limit:Number, max_devices:Number, expires_at:String, created_at:String},{_id:false, collection:'users', strict:false})
export const FirebaseSchema = new mongoose.Schema({_id:String, id:String, name:String, database_url:String, service_account_json:String, status:String, last_tested_at:String, device_count:Number, created_at:String},{_id:false, collection:'firebases', strict:false})
export const DeviceSchema = new mongoose.Schema({_id:String, id:String, firebase_id:String, name:String, model:String, status:String, battery:Number, signal:Number, last_seen:String, total_sent:Number, total_failed:Number, extra:String, created_at:String, sim_count:Number, has_recharge:Number, sim1_recharge:Number, sim2_recharge:Number, validated_score:Number, validated_at:String, validator_fail_count:Number},{_id:false, collection:'devices', strict:false})
export const CampaignSchema = new mongoose.Schema({_id:String, id:String, name:String, template:String, status:String, total:Number, sent:Number, failed:Number, pending:Number, created_at:String, started_at:String, finished_at:String},{_id:false, collection:'campaigns', strict:false})
export const CampaignMessageSchema = new mongoose.Schema({_id:String, id:String, campaign_id:String, phone:String, variables:String, rendered:String, status:String, device_id:String, firebase_id:String, attempts:Number, last_error:String, sent_at:String, created_at:String},{_id:false, collection:'campaign_messages', strict:false})
export const QueueItemSchema = new mongoose.Schema({_id:String, id:String, campaign_id:String, message_id:String, priority:Number, status:String, created_at:String},{_id:false, collection:'queue_items', strict:false})
export const SettingSchema = new mongoose.Schema({_id:String, key:String, value:String, updated_at:String},{_id:false, collection:'settings', strict:false})
export const SessionSchema = new mongoose.Schema({_id:String, user_id:String, ip:String, device_id:String, token:String, last_active:String},{_id:false, collection:'sessions', strict:false})

export function getModels(){
  const User = mongoose.models.User || mongoose.model('User', UserSchema)
  const Firebase = mongoose.models.Firebase || mongoose.model('Firebase', FirebaseSchema)
  const Device = mongoose.models.Device || mongoose.model('Device', DeviceSchema)
  const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema)
  const CampaignMessage = mongoose.models.CampaignMessage || mongoose.model('CampaignMessage', CampaignMessageSchema)
  const QueueItem = mongoose.models.QueueItem || mongoose.model('QueueItem', QueueItemSchema)
  const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema)
  const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema)
  return {User, Firebase, Device, Campaign, CampaignMessage, QueueItem, Setting, Session}
}
