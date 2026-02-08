--  SPARK/Ada specification for minimal accounting operations
pragma SPARK_Mode (On);
package Bolh_Accounting is
   type Amount is new Integer;

   --  Check that a balance is non-negative
   function Valid_Balance (B : Amount) return Boolean
     with Pre => B >= 0;

   --  Add funds to a balance
   procedure Credit (Balance : in out Amount; Amount_To_Add : Amount)
     with Pre => Amount_To_Add >= 0;

   --  Subtract funds from a balance (fails precondition if insufficient)
   procedure Debit (Balance : in out Amount; Amount_To_Subtract : Amount)
     with Pre => Amount_To_Subtract >= 0 and then Balance >= Amount_To_Subtract;
end Bolh_Accounting;
package Bolh_Accounting is
   type Account_Id is new String(1..100);
   type Balance is new Integer;

   -- Initialize accounting module
   procedure Init;

   -- Credit account (used by miner rewards / referrals)
   procedure Credit(A : in Account_Id; Amount : in Balance);

   -- Debit account
   procedure Debit(A : in Account_Id; Amount : in Balance);

   -- Query balance
   function Get_Balance(A : in Account_Id) return Balance;
end Bolh_Accounting;
