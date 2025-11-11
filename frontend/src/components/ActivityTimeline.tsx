import React from "react";
import { ActivityLog } from "../types";

interface ActivityTimelineProps {
  activities: ActivityLog[];
  isLoading?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, isLoading = false }) => {
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "created":
        return "✨";
      case "status_changed":
        return "🔄";
      case "stage_changed":
        return "📍";
      case "description_updated":
        return "📝";
      case "assigned":
        return "👤";
      case "policy_created":
        return "📄";
      case "quote_added":
        return "💰";
      case "document_uploaded":
        return "📎";
      case "payment_created":
        return "💳";
      case "comment_added":
        return "💬";
      default:
        return "📌";
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "created":
        return "#10b981";
      case "status_changed":
        return "#f59e0b";
      case "stage_changed":
        return "#3b82f6";
      case "policy_created":
        return "#8b5cf6";
      case "payment_created":
        return "#ec4899";
      default:
        return "#6b7280";
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading) {
    return <div className="activity-loading">Загрузка истории...</div>;
  }

  if (activities.length === 0) {
    return <div className="activity-empty">Пока нет действий</div>;
  }

  return (
    <div className="activity-timeline">
      {activities.map((activity, index) => (
        <div key={activity.id} className="activity-item">
          <div className="activity-marker" style={{ backgroundColor: getActionColor(activity.actionType) }}>
            {getActionIcon(activity.actionType)}
          </div>
          <div className="activity-content">
            <div className="activity-header">
              <span className="activity-action">{activity.actionTypeDisplay}</span>
              {activity.userUsername && (
                <span className="activity-user">— {activity.userUsername}</span>
              )}
              <span className="activity-time">{formatDateTime(activity.createdAt)}</span>
            </div>
            <div className="activity-description">{activity.description}</div>
            {activity.oldValue && activity.newValue && (
              <div className="activity-changes">
                <span className="old-value">было: {activity.oldValue}</span>
                <span className="arrow">→</span>
                <span className="new-value">стало: {activity.newValue}</span>
              </div>
            )}
          </div>
          {index !== activities.length - 1 && <div className="activity-connector" />}
        </div>
      ))}
      <style>{`
        .activity-timeline {
          position: relative;
          padding: 20px 0;
        }

        .activity-loading,
        .activity-empty {
          padding: 20px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
        }

        .activity-item {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          position: relative;
        }

        .activity-marker {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .activity-connector {
          position: absolute;
          left: 19px;
          top: 40px;
          width: 2px;
          height: calc(100% + 16px);
          background: #e2e8f0;
        }

        .activity-content {
          flex: 1;
          padding-top: 4px;
        }

        .activity-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .activity-action {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
        }

        .activity-user {
          color: #64748b;
          font-size: 13px;
        }

        .activity-time {
          color: #94a3b8;
          font-size: 12px;
          margin-left: auto;
        }

        .activity-description {
          color: #475569;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .activity-changes {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f8fafc;
          border-radius: 4px;
          font-size: 12px;
          color: #64748b;
          flex-wrap: wrap;
        }

        .old-value {
          background: #fee2e2;
          color: #991b1b;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }

        .arrow {
          color: #94a3b8;
          font-weight: bold;
        }

        .new-value {
          background: #dcfce7;
          color: #166534;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};
