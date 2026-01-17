export const ApprovalRequestStatus = {
  PENDING: 'PENDING',
  ANSWERED: 'ANSWERED',
  CANCELED: 'CANCELED',
};
export type ApprovalRequestStatus = keyof typeof ApprovalRequestStatus;
export type ApprovalRequestStatusValue =
  (typeof ApprovalRequestStatus)[keyof typeof ApprovalRequestStatus];

export enum ApprovalRequestStatusEnum {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  CANCELED = 'CANCELED',
}
