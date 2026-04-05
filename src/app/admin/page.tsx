"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users, Search, Activity, MoreVertical, Trash2, CheckCircle2 } from "lucide-react";

export default function AdminDashboard() {
  const { user, users, toggleUserStatus, deleteUser, fetchAllProfiles } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Sync data from cloud on mount
    fetchAllProfiles();

    // Basic protection
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router, fetchAllProfiles]);

  if (user?.role !== "admin") return null;

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldCheck size={24} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Control Panel</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts, roles, and platform activity.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0"><Users size={20} /></div>
          <div>
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-lg shrink-0"><CheckCircle2 size={20} /></div>
          <div>
            <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            <p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg shrink-0"><Activity size={20} /></div>
          <div>
            <p className="text-sm text-muted-foreground">Pending Verifications</p>
            <p className="text-2xl font-bold">{users.filter(u => u.status === 'pending').length}</p>
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <h2 className="font-semibold text-foreground">User Management</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search user..."
              className="pl-8 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/50 w-full max-w-[200px]"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/10">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Join Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                      u.role === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-inline items-center gap-1.5 w-fit ${
                      u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${u.status === 'active' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                      {u.status === 'active' ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {u.joined}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => toggleUserStatus(u.id, u.status)}
                        className="px-3 py-1 bg-accent hover:bg-accent/80 text-foreground rounded text-xs transition-colors"
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
