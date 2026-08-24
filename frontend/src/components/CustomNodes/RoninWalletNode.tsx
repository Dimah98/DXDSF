import React from "react";
import { Handle, Position } from "@xyflow/react";
import BaseNode from "./BaseNode";
import { Wallet } from "lucide-react";
import { NODE_CONFIG } from "../../nodeConfig";

export const RoninWalletNode = ({ id, data, selected }: any) => {
  const config = NODE_CONFIG.roninWalletNode;

  return (
    <BaseNode
      id={id}
      icon={<Wallet size={16} />}
      title={config.label}
      bgColor={config.defaultColor}
      data={data} type="roninWalletNode"
    >
      <div className="text-xs text-slate-400 mt-1 mb-2">
        <div className="flex justify-between items-center bg-slate-900/50 rounded px-2 py-1 border border-slate-700/50">
          <span>Спроб:</span>
          <span className="text-blue-400">{data.maxAttempts || 3}</span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: "#94a3b8", width: 8, height: 8 }}
      />
      
      {/* Зелений порт: Успішно підтверджено */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={{ background: "#10b981", width: 10, height: 10, top: "35%" }}
      />
      <div
        style={{
          position: "absolute",
          right: "-55px",
          top: "30%",
          fontSize: "10px",
          color: "#10b981",
        }}
      >
        Успіх
      </div>

      {/* Червоний порт: Помилка */}
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={{ background: "#ef4444", width: 10, height: 10, top: "65%" }}
      />
      <div
        style={{
          position: "absolute",
          right: "-65px",
          top: "60%",
          fontSize: "10px",
          color: "#ef4444",
        }}
      >
        Помилка
      </div>
    </BaseNode>
  );
};

