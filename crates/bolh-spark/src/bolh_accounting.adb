--  Minimal SPARK/Ada implementation for accounting
pragma SPARK_Mode (On);
package body Bolh_Accounting is

   function Valid_Balance (B : Amount) return Boolean is
   begin
      return B >= 0;
   end Valid_Balance;

   procedure Credit (Balance : in out Amount; Amount_To_Add : Amount) is
   begin
      Balance := Balance + Amount_To_Add;
   end Credit;

   procedure Debit (Balance : in out Amount; Amount_To_Subtract : Amount) is
   begin
      Balance := Balance - Amount_To_Subtract;
   end Debit;

end Bolh_Accounting;
package body Bolh_Accounting is
   -- Simple PoC in-memory map (replace with proven implementation)
   package Map is new Ada.Containers.Ordered_Maps(Keys => String, Elements => Integer);
   use Map;

   G : Map.Map := Map.Empty;

   procedure Init is
   begin
      null;
   end Init;

   procedure Credit(A : in Account_Id; Amount : in Balance) is
      Found : Boolean;
      Cur   : Integer;
   begin
      if Map.Contains(G, A) then
         Cur := Map.Element(G, A);
         Map.Replace_Element(G, A, Cur + Integer(Amount));
      else
         Map.Insert(G, A, Integer(Amount));
      end if;
   end Credit;

   procedure Debit(A : in Account_Id; Amount : in Balance) is
      Cur : Integer := 0;
   begin
      if Map.Contains(G, A) then
         Cur := Map.Element(G, A);
      end if;
      Map.Replace_Element(G, A, Cur - Integer(Amount));
   end Debit;

   function Get_Balance(A : in Account_Id) return Balance is
      Cur : Integer := 0;
   begin
      if Map.Contains(G, A) then
         Cur := Map.Element(G, A);
      end if;
      return Balance(Cur);
   end Get_Balance;
end Bolh_Accounting;
